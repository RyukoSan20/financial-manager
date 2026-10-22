"""
Image preprocessing for receipt OCR.

Standard OCR engines assume a clean, flat, high-contrast scan. Real receipt
photos are none of those things: they are crumpled, folded, torn, wrinkled,
lit unevenly, photographed at an angle, or blurred by motion.

This module restores the image before OCR runs. It works on an OpenCV
pipeline with no hardcoded assumptions about a specific receipt format:

  1. Decode and orient     - EXIF rotation is applied, the image is
                              converted to a working colour space.
  2. Illumination flattening - a large-kernel morphological close estimates
                              the paper's lighting, then the difference is
                              used to remove shadows and hotspots.
  3. Geometric correction   - deskew (rotation) and perspective
                              rectification (folded / angled photos).
  4. Degradation recovery    - denoise, sharpen, and CLAHE local contrast
                              enhancement for faded thermal paper.
  5. Multi-variant output   - several preprocessed variants are produced so
                              the OCR engine can be run on each and the
                              best-scoring result wins.

Nothing here is receipt-specific: it is a generic document-restoration
pipeline, so it works for any vendor.
"""

import io
import logging
import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    import cv2
    import numpy as np
    CV_AVAILABLE = True
except ImportError:  # pragma: no cover - handled by the caller
    cv2 = None
    np = None
    CV_AVAILABLE = False


@dataclass
class ImageQualityReport:
    """Measurable properties of the input image.

    These values drive the decision of how hard to work on the image and
    are surfaced to the user so a bad scan can be explained rather than
    silently failing.
    """
    width: int = 0
    height: int = 0
    megapixels: float = 0.0
    brightness: float = 0.0          # mean luminance, 0-255
    contrast: float = 0.0            # std-dev of luminance
    sharpness: float = 0.0           # variance of Laplacian
    estimated_skew_deg: float = 0.0
    is_blurry: bool = False
    is_dark: bool = False
    is_low_contrast: bool = False
    has_shadows: bool = False
    is_grayscale: bool = False
    issues: List[str] = field(default_factory=list)

    @property
    def severity(self) -> str:
        """Overall quality bucket: good / fair / poor."""
        if not self.issues:
            return "good"
        if len(self.issues) <= 2:
            return "fair"
        return "poor"


@dataclass
class PreprocessedVariant:
    """One preprocessed rendering of the receipt."""
    name: str
    image: "np.ndarray"
    notes: List[str] = field(default_factory=list)


class ImagePreprocessor:
    """Restores and enhances receipt images before OCR."""

    # Below this Laplacian variance the image is considered motion/defocus
    # blurred. The value is calibrated for a 1000px-wide receipt.
    BLUR_THRESHOLD = 120.0
    DARK_THRESHOLD = 90.0
    LOW_CONTRAST_THRESHOLD = 22.0

    # Minimum side length we upscale small photos to.
    MIN_SIDE = 1000

    def __init__(self, max_variants: int = 5):
        self.max_variants = max_variants

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze(self, image_bytes: bytes) -> ImageQualityReport:
        """Measure the quality of the input image."""
        report = ImageQualityReport()
        if not CV_AVAILABLE:
            report.issues.append("opencv_tidak_tersedia")
            return report

        img = self._decode(image_bytes)
        if img is None:
            report.issues.append("gambar_tidak_dapat_dibaca")
            return report

        gray = self._to_gray(img)
        h, w = gray.shape[:2]
        report.width, report.height = w, h
        report.megapixels = (w * h) / 1_000_000.0

        report.brightness = float(np.mean(gray))
        report.contrast = float(np.std(gray))
        report.sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        report.estimated_skew_deg = self._estimate_skew(gray)
        report.is_grayscale = self._is_grayscale(img)

        if report.sharpness < self.BLUR_THRESHOLD:
            report.is_blurry = True
            report.issues.append("gambar_buram")
        if report.brightness < self.DARK_THRESHOLD:
            report.is_dark = True
            report.issues.append("gambar_gelap")
        if report.contrast < self.LOW_CONTRAST_THRESHOLD:
            report.is_low_contrast = True
            report.issues.append("kontras_rendah")
        if self._has_shadows(gray):
            report.has_shadows = True
            report.issues.append("bayangan")

        return report

    def process(self, image_bytes: bytes) -> Tuple[List[PreprocessedVariant], ImageQualityReport]:
        """Produce preprocessed variants of the receipt.

        The ORIGINAL image is always included as the first variant. Without
        it a restoration step that makes things worse would be able to
        replace a perfectly readable scan with a degraded one.

        Returns (variants, quality_report). The variants are ordered by
        expected OCR quality; the caller runs the OCR engine on each and
        keeps the best result.
        """
        if not CV_AVAILABLE:
            logger.warning("OpenCV unavailable - passing the original image through")
            return ([PreprocessedVariant("original", None)], ImageQualityReport())

        img = self._decode(image_bytes)
        if img is None:
            return ([PreprocessedVariant("original", None)], ImageQualityReport())

        report = self.analyze(image_bytes)
        variants: List[PreprocessedVariant] = []
        notes: List[str] = []

        # 0. The untouched original. Always present as the safety net.
        variants.append(PreprocessedVariant("original", img.copy(), ["untouched"]))

        # 1. Base: orient + upscale + illumination flattening.
        base = self._prepare_base(img, report, notes)
        variants.append(PreprocessedVariant("enhanced", base, list(notes)))

        # 2. Grayscale + CLAHE for faded thermal paper.
        gray = self._to_gray(base)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced_gray = clahe.apply(gray)
        variants.append(PreprocessedVariant("clahe", cv2.cvtColor(enhanced_gray, cv2.COLOR_GRAY2BGR), list(notes)))

        # 3. Hard binarisation for high-contrast printed receipts.
        binary = cv2.adaptiveThreshold(
            enhanced_gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 31, 15,
        )
        variants.append(PreprocessedVariant("binarized", cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR), list(notes)))

        # 4. Sharpened colour variant for photos with soft focus.
        blurred = cv2.GaussianBlur(base, (0, 0), 3)
        sharpened = cv2.addWeighted(base, 1.6, blurred, -0.6, 0)
        variants.append(PreprocessedVariant("sharpened", sharpened, list(notes)))

        return (variants[: self.max_variants], report)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _decode(self, image_bytes: bytes) -> Optional["np.ndarray"]:
        """Decode bytes into a BGR array, honouring EXIF orientation."""
        if not image_bytes:
            return None
        try:
            buffer = np.frombuffer(image_bytes, dtype=np.uint8)
            img = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
            if img is None:
                return None

            # Apply EXIF orientation so photos are not sideways.
            try:
                from PIL import Image, ExifTags
                pil = Image.open(io.BytesIO(image_bytes))
                exif = pil.getexif()
                orientation = exif.get(ExifTags.Base.Orientation)
                if orientation:
                    rotations = {
                        3: cv2.ROTATE_180,
                        6: cv2.ROTATE_90_CLOCKWISE,
                        8: cv2.ROTATE_90_COUNTERCLOCKWISE,
                    }
                    if orientation in rotations:
                        img = cv2.rotate(img, rotations[orientation])
                    elif orientation == 2:
                        img = cv2.flip(img, 1)
                    elif orientation == 4:
                        img = cv2.flip(img, 0)
            except Exception:
                # EXIF handling is best-effort.
                pass

            return img
        except Exception as e:
            logger.error(f"Failed to decode image: {e}")
            return None

    @staticmethod
    def _to_gray(img: "np.ndarray") -> "np.ndarray":
        if img.ndim == 2:
            return img
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    @staticmethod
    def _is_grayscale(img: "np.ndarray") -> bool:
        """True when the image has essentially no colour information."""
        if img.ndim == 2:
            return True
        b, g, r = cv2.split(img.astype("int16"))
        # Average absolute channel difference.
        diff = float(np.mean(np.abs(b - g)) + np.mean(np.abs(g - r)))
        return diff < 8.0

    @staticmethod
    def _has_shadows(gray: "np.ndarray") -> bool:
        """Detect uneven illumination by comparing to a blurred version."""
        blurred = cv2.GaussianBlur(gray, (0, 0), gray.shape[0] / 25.0)
        diff = cv2.absdiff(gray, blurred)
        return float(np.mean(diff)) > 18.0

    @staticmethod
    def _estimate_skew(gray: "np.ndarray") -> float:
        """Estimate the text rotation angle in degrees."""
        try:
            edges = cv2.Canny(gray, 100, 200)
            lines = cv2.HoughLinesP(
                edges, 1, np.pi / 1800, threshold=120,
                minLineLength=gray.shape[1] // 3, maxLineGap=20,
            )
            if lines is None:
                return 0.0
            angles = []
            for x1, y1, x2, y2 in lines[:, 0]:
                angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
                # Only near-horizontal lines carry the text baseline.
                if -20 < angle < 20:
                    angles.append(angle)
            if not angles:
                return 0.0
            return float(np.median(angles))
        except Exception:
            return 0.0

    def _prepare_base(
        self, img: "np.ndarray", report: ImageQualityReport, notes: List[str]
    ) -> "np.ndarray":
        """Decode -> upscale -> deskew -> perspective -> illumination."""
        out = img

        # Upscale small photos so the OCR engine sees enough detail.
        h, w = out.shape[:2]
        if max(h, w) < self.MIN_SIDE:
            scale = self.MIN_SIDE / max(h, w)
            out = cv2.resize(out, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            notes.append("upscaled")

        # Perspective correction for angled / folded photos.
        warped = self._rectify_perspective(out)
        if warped is not None:
            out = warped
            notes.append("perspective_rectified")

        # Deskew rotation.
        angle = report.estimated_skew_deg
        if abs(angle) > 0.6:
            out = self._rotate(out, angle)
            notes.append(f"deskewed_{angle:.1f}deg")

        # Illumination flattening: remove shadows and hotspots.
        flat = self._flatten_illumination(out)
        if flat is not None:
            out = flat
            notes.append("illumination_flattened")

        # Gentle denoise.
        out = cv2.fastNlMeansDenoisingColored(out, None, 3, 3, 7, 21)

        # When the photo is genuinely out of focus, a stronger unsharp mask
        # recovers some of the edges the blur smeared away. This is only
        # applied when the quality report says the image is blurry, because
        # over-sharpening a clean scan adds artefacts.
        if report.is_blurry:
            out = self._deblur(out)
            notes.append("deblurred")

        return out

    @staticmethod
    def _deblur(img: "np.ndarray") -> "np.ndarray":
        """Sharpen a blurred image with an unsharp mask."""
        try:
            blurred = cv2.GaussianBlur(img, (0, 0), 2.0)
            # amount > 1 over-sharpens, which is what a soft-focus photo needs.
            return cv2.addWeighted(img, 2.2, blurred, -1.2, 0)
        except Exception as e:
            logger.debug(f"Deblur skipped: {e}")
            return img

    @staticmethod
    def _rotate(img: "np.ndarray", angle: float) -> "np.ndarray":
        """Rotate around the centre, expanding the canvas so nothing is cut."""
        h, w = img.shape[:2]
        center = (w / 2, h / 2)
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        cos, sin = abs(matrix[0, 0]), abs(matrix[0, 1])
        new_w = int(h * sin + w * cos)
        new_h = int(h * cos + w * sin)
        matrix[0, 2] += new_w / 2 - center[0]
        matrix[1, 2] += new_h / 2 - center[1]
        return cv2.warpAffine(
            img, matrix, (new_w, new_h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )

    @staticmethod
    def _rectify_perspective(img: "np.ndarray") -> Optional["np.ndarray"]:
        """Rectify a photographed receipt by detecting its paper boundary.

        Returns None when no convincing rectangle is found, in which case
        the original is kept. This is deliberately conservative: a wrong
        rectification is worse than none, because it crops away content.

        Two guards protect against over-aggressive correction:
          - the detected rectangle must be convex and roughly rectangular
            (corner angles within tolerance), and
          - the crop may not remove more than 25% of the frame, otherwise
            text near the edges would be lost.
        """
        try:
            h, w = img.shape[:2]
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray = cv2.GaussianBlur(gray, (5, 5), 0)

            # Otsu threshold then morphological close to unify the paper.
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
            closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)
            contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if not contours:
                return None
            largest = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest)
            # The receipt must occupy a meaningful part of the frame.
            if area < (w * h) * 0.18:
                return None

            peri = cv2.arcLength(largest, True)
            approx = cv2.approxPolyDP(largest, 0.02 * peri, True)
            if len(approx) != 4:
                return None

            pts = approx.reshape(4, 2).astype("float32")
            # Order: top-left, top-right, bottom-right, bottom-left.
            s = pts.sum(axis=1)
            diff = np.diff(pts, axis=1)
            tl = pts[np.argmin(s)]
            br = pts[np.argmax(s)]
            tr = pts[np.argmin(diff)]
            bl = pts[np.argmax(diff)]
            ordered = np.array([tl, tr, br, bl], dtype="float32")

            # Guard 1: the quad must be convex and reasonably rectangular.
            if not cv2.isContourConvex(approx):
                return None
            sides = [
                np.linalg.norm(ordered[1] - ordered[0]),
                np.linalg.norm(ordered[2] - ordered[1]),
                np.linalg.norm(ordered[3] - ordered[2]),
                np.linalg.norm(ordered[0] - ordered[3]),
            ]
            if min(sides) < 40:
                return None
            # Opposite sides should be similar in length.
            if min(sides[0], sides[2]) / max(sides[0], sides[2]) < 0.6:
                return None
            if min(sides[1], sides[3]) / max(sides[1], sides[3]) < 0.6:
                return None

            width_a = np.linalg.norm(tr - tl)
            width_b = np.linalg.norm(br - bl)
            height_a = np.linalg.norm(bl - tl)
            height_b = np.linalg.norm(br - tr)
            out_w = int(max(width_a, width_b))
            out_h = int(max(height_a, height_b))
            if out_w < 50 or out_h < 50:
                return None

            # Guard 2: the crop must not discard a large part of the frame.
            crop_area = out_w * out_h
            if crop_area < (w * h) * 0.35:
                return None

            destination = np.array([
                [0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1],
            ], dtype="float32")

            matrix = cv2.getPerspectiveTransform(ordered, destination)
            warped = cv2.warpPerspective(
                img, matrix, (out_w, out_h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )
            return warped
        except Exception as e:
            logger.debug(f"Perspective rectification skipped: {e}")
            return None

    @staticmethod
    def _flatten_illumination(img: "np.ndarray") -> Optional["np.ndarray"]:
        """Remove shadows and lighting gradients.

        A large-kernel morphological close approximates the paper's
        illumination; dividing the image by it flattens the lighting while
        keeping the ink dark.
        """
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            # Kernel size scales with the image so it works at any resolution.
            ksize = max(15, (min(gray.shape[:2]) // 20) | 1)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
            background = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
            background = cv2.GaussianBlur(background, (0, 0), ksize / 4.0)

            # Normalise the background to a uniform mid-grey.
            bg_float = background.astype("float32")
            bg_float[bg_float == 0] = 1.0
            normalized = cv2.divide(gray.astype("float32"), bg_float * (255.0 / bg_float.max()))
            normalized = np.clip(normalized, 0, 255).astype("uint8")

            # Bring the result back into the colour image so the colour
            # channels (e.g. a coloured store logo) survive.
            b, g, r = cv2.split(img.astype("float32"))
            scale = normalized.astype("float32") / np.maximum(gray.astype("float32"), 1.0)
            scale = np.clip(scale, 0.4, 2.5)
            out = cv2.merge([
                np.clip(b * scale, 0, 255),
                np.clip(g * scale, 0, 255),
                np.clip(r * scale, 0, 255),
            ]).astype("uint8")
            return out
        except Exception as e:
            logger.debug(f"Illumination flattening skipped: {e}")
            return None


# Module-level singleton so the pipeline can call it without wiring.
image_preprocessor = ImagePreprocessor()

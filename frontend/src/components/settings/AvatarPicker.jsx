/**
 * Which face.
 *
 * The reader can put a picture on their profile, and that picture is
 * a URL they type in. That is not a choice, it is a chore, and most
 * people never do it.
 *
 * So there are four drawn faces as well, in the colours of the
 * application. They are drawn rather than photographed, which means
 * they are not a stranger's face and they carry no licence question.
 * The reader picks one, it is saved as the avatar, and the corner of
 * the application looks like them.
 *
 * The typed URL is still there. Somebody who wants their own picture
 * can still put one in; the picker does not take that away.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from '../../i18n';
import { getUserAvatarUrl } from '../../utils/avatarHelper';

/**
 * The drawn faces.
 *
 * The paths are of the application, so they are served from the same
 * place as the logo and the pins.
 */
export const AVATAR_CHOICES = [
  { id: 'avatar-default', tone: 'green' },
  { id: 'avatar-sun', tone: 'warm' },
  { id: 'avatar-sky', tone: 'cool' },
  { id: 'avatar-rose', tone: 'bright' },
];

const assetUrl = (name) =>
  `${import.meta.env.BASE_URL}assets/generated/brand/${name}.svg`;

/**
 * The picker.
 *
 * `value` is the avatar currently on the profile. It may be a URL the
 * reader typed, or the path of one of the drawn faces, or empty.
 */
export const AvatarPicker = ({ value, onChange, onUpload }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const chosen = AVATAR_CHOICES.find(
    (choice) => value === assetUrl(choice.id) || value === choice.id
  );

  // The preview is always one of ours.
  //
  // A reader who signed in with Google had their Google photo in
  // this box - a picture of a person, from a server we do not
  // control, and a licence question nobody asked about. The picture
  // in the box is now always one of the four we drew, and a photo
  // from an email provider is ignored.
  const preview = chosen ? assetUrl(chosen.id) : getUserAvatarUrl({ avatar_url: value });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <img
          src={preview}
          alt=""
          className="w-16 h-16 rounded-2xl object-cover shadow-sm"
          onError={(e) => {
            e.currentTarget.src = assetUrl('avatar-default');
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('profile_settings.choose_avatar')}
          </button>
          {onUpload && (
            <button
              type="button"
              onClick={onUpload}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('profile_settings.upload_avatar')}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="flex flex-wrap gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          {AVATAR_CHOICES.map((choice) => {
            const url = assetUrl(choice.id);
            const active = chosen?.id === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => {
                  onChange(url);
                  setOpen(false);
                }}
                aria-label={t(`profile_settings.avatar_${choice.tone}`)}
                aria-pressed={active}
                className={clsx(
                  'w-14 h-14 rounded-xl overflow-hidden transition-[border-color,box-shadow,transform]',
                  active
                    ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900'
                    : 'hover:scale-105'
                )}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            );
          })}
        </div>
      )}

      {/* The typed URL stays. Somebody who wants their own picture can
          still put one in; the picker does not take that away. */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('profile_settings.label_avatar')}
        </label>
        <input
          type="url"
          value={value?.startsWith('http') ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          placeholder={t('profile_settings.website')}
        />
      </div>
    </div>
  );
};

export default AvatarPicker;

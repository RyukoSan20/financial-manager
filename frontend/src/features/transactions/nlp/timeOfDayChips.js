/**
 * The chips of the hour.
 *
 * A reader who opens the add page in the morning is usually about to
 * buy a coffee. One in the afternoon is usually about to eat. One in
 * the evening is usually about to go home.
 *
 * So the chips above the quick entry box are the three things that
 * are most likely, and they change with the time of day. One tap
 * fills in the amount, the name, the category and the sub-category,
 * and the reader can change any of them afterwards.
 *
 * The chips are a suggestion, not a decision. The reader who wants
 * something else writes it.
 */

/**
 * The chips of each part of the day.
 *
 * `icon` names the drawing in the pixel icon family - the same
 * family the rest of the page uses, so the chips match the page
 * instead of the phone's emoji font. `label` is the name, `amount` is the
 * figure, `text` is what goes into the quick entry box - which is
 * then read the same way as anything else the reader types.
 */
export const CHIPS_BY_PART_OF_DAY = {
  morning: [
    { icon: 'coffee', label: 'Kopi', amount: 10000, text: 'Kopi 10rb' },
    { icon: 'food', label: 'Sarapan', amount: 15000, text: 'Sarapan 15rb' },
    { icon: 'smartphone', label: 'Ojol', amount: 12000, text: 'Ojol 12rb' },
  ],
  midday: [
    { icon: 'food', label: 'Makan Siang', amount: 25000, text: 'Makan siang 25rb' },
    { icon: 'coffee', label: 'Kopi', amount: 10000, text: 'Kopi 10rb' },
    { icon: 'food', label: 'Mie Ayam', amount: 18000, text: 'Mie ayam 18rb' },
  ],
  afternoon: [
    { icon: 'coffee', label: 'Kopi', amount: 10000, text: 'Kopi 10rb' },
    { icon: 'food', label: 'Camilan', amount: 15000, text: 'Camilan 15rb' },
    { icon: 'smartphone', label: 'Ojol', amount: 12000, text: 'Ojol 12rb' },
  ],
  evening: [
    { icon: 'food', label: 'Makan Malam', amount: 30000, text: 'Makan malam 30rb' },
    { icon: 'food', label: 'Pesan Antar', amount: 35000, text: 'Pesan antar 35rb' },
    { icon: 'smartphone', label: 'Ojol', amount: 12000, text: 'Ojol 12rb' },
  ],
  night: [
    { icon: 'food', label: 'Mie Instan', amount: 12000, text: 'Mie instan 12rb' },
    { icon: 'smartphone', label: 'Ojol', amount: 12000, text: 'Ojol 12rb' },
    { icon: 'coffee', label: 'Kopi', amount: 10000, text: 'Kopi 10rb' },
  ],
};

/**
 * Which part of the day it is.
 *
 * The clock is read in the reader's own timezone - Jakarta, in this
 * case - because "morning" means morning where the reader is, and a
 * reader in Jakarta at seven in the evening is not having breakfast.
 *
 * The hours are:
 *
 *   5 to 10   morning
 *   11 to 14  midday
 *   15 to 17  afternoon
 *   18 to 20  evening
 *   21 to 4   night
 */
export function partOfDay(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      hour12: false,
    }).format(date)
  );

  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 21) return 'evening';
  return 'night';
}

/**
 * The chips for this moment.
 */
export function chipsFor(date = new Date()) {
  return CHIPS_BY_PART_OF_DAY[partOfDay(date)] || CHIPS_BY_PART_OF_DAY.morning;
}

export default {
  CHIPS_BY_PART_OF_DAY,
  partOfDay,
  chipsFor,
};

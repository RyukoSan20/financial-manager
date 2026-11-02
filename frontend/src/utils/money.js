// The money, as the screen shows it.
//
// This is a plain module and not part of a component, because the
// tests read it and a test cannot read a file that holds markup.
//
// The rule of the whole application is that the server works the money
// out and the screen shows it. So the only thing this does is write
// the number the server sent. It does not round it, because a price
// that is rounded on the way to the screen is a price that is no
// longer the one that was worked out, and the difference between the
// two is what makes a receipt fail to add up.
//
// The grouping is the Indonesian one: a dot every three digits and a
// comma for the decimals.

/**
 * The price, in rupiah.
 *
 * A rupiah has no cents in the way a dollar does, but the money that
 * the tax engine works out can have a fraction, so the fraction is
 * kept when there is one. It is shown with two places, because
 * "Rp 9.166,7" is not a way to write money.
 */
export const formatRupiah = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 'Rp 0';

  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  const grouped = whole.toLocaleString('id-ID');

  return cents ? `Rp ${grouped},${String(cents).padStart(2, '0')}` : `Rp ${grouped}`;
};

export default formatRupiah;

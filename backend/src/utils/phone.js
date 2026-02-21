/**
 * Phone number normalization utility.
 * Converts various formats into clean E.164-style format for Termii.
 * E.g.: 08012345678 → 2348012345678 (Nigeria)
 */
const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '234';

function normalizePhone(raw) {
    if (!raw) return null;

    // Strip everything that isn't a digit or leading +
    let number = String(raw).replace(/[^\d+]/g, '');

    // Remove leading +
    if (number.startsWith('+')) {
        number = number.slice(1);
    }

    // If starts with 0, swap with country code
    if (number.startsWith('0')) {
        number = DEFAULT_COUNTRY_CODE + number.slice(1);
    }

    // If the number doesn't already start with the country code, prepend it
    // (handles cases like 8012345678 missing the leading 0)
    if (!number.startsWith(DEFAULT_COUNTRY_CODE) && number.length < 12) {
        number = DEFAULT_COUNTRY_CODE + number;
    }

    // Validate minimum length (country code + at least 7 digits)
    if (number.length < DEFAULT_COUNTRY_CODE.length + 7) {
        return null;
    }

    return number;
}

/**
 * Validate that a phone number looks correctly normalized.
 */
function isValidPhone(phone) {
    return typeof phone === 'string' && /^\d{10,15}$/.test(phone);
}

module.exports = { normalizePhone, isValidPhone };

// utils/dayJs.js
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// ⚙️ Importiere unterstützte Sprachen
import 'dayjs/locale/de';
import 'dayjs/locale/en';
import 'dayjs/locale/fr'; // Beispiel – weitere Sprachen möglich

// Plugins aktivieren
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);

// --------------------------
// 🌍 Lokalisierung & Zeitzone
// --------------------------

// 🧭 Automatische Browser-Erkennung
const detectBrowserLocale = () => {
    if (typeof navigator === 'undefined') return 'en';
    const lang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
    return lang.split('-')[0]; // z. B. "de-DE" → "de"
};

const detectSystemTimezone = () =>
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// 🕓 Standard initialisieren
let currentLocale = detectBrowserLocale();
const systemTimeZone = detectSystemTimezone();

dayjs.locale(currentLocale);
dayjs.tz.setDefault(systemTimeZone);

// --------------------------
// 🔹 Einheitliche Day.js-Konvertierung
// --------------------------
/**
 * Wandelt beliebige Zeitangaben in ein Day.js-Objekt um.
 * Unterstützt:
 * - Day.js-Objekte → unverändert
 * - Unix-Sekunden → dayjs.unix(sec)
 * - Millisekunden (JS Timestamp) → dayjs(ms)
 * - Date Objekte → dayjs(date)
 * - String → dayjs(string)
 * @param {number|Date|string|dayjs.Dayjs} date
 * @returns {dayjs.Dayjs}
 */
export const toDayjs = (date) => {
    if (dayjs.isDayjs(date)) return date;
    if (typeof date === 'number') {
        if (date < 1e12) return dayjs.unix(date); // Unix-Sekunden
        return dayjs(date);                        // Millisekunden
    }
    if (date instanceof Date) return dayjs(date);
    return dayjs(date); // Fallback: String oder unbekanntes Format
};

// --------------------------
// 🌍 Lokalisierung & Zeitzone Funktionen
// --------------------------
export const setLocale = (locale = 'de') => {
    try {
        dayjs.locale(locale);
        currentLocale = locale;
        dayjs.tz.setDefault(detectSystemTimezone());
    } catch (err) {
        console.warn(`[dayjsHelper] Locale '${locale}' konnte nicht gesetzt werden.`, err);
    }
};

export const getLocale = () => currentLocale;
export const getTimezone = () => detectSystemTimezone();

export const initLocalization = () => {
    const locale = detectBrowserLocale();
    const tz = detectSystemTimezone();
    dayjs.locale(locale);
    dayjs.tz.setDefault(tz);
    currentLocale = locale;
    console.log(
        `Locale: %c${locale} %c| Timezone: %c${tz}`,
        'color: #2196F3; font-weight: bold;',
        '',
        'color: #FF9800; font-weight: bold;'
    );
    return { locale, tz };
};

// --------------------------
// ✅ Basis-Zeitfunktionen
// --------------------------
export const now = () => dayjs();
export const nowMs = () => Date.now();
export const nowUnix = () => dayjs().unix();

// --------------------------
// 🔄 Konvertierungen
// --------------------------
export const fromMs = (ms) => dayjs(ms);
export const toMs = (d) => toDayjs(d).valueOf();
export const fromUnix = (sec) => dayjs.unix(sec);
export const toUnix = (d) => toDayjs(d).unix();

// --------------------------
// 🧩 Formatierungshelfer
// --------------------------
export const DateFormats = {
    shortDate: 'D. MMMM',
    longDate: 'D. MMMM YYYY',
    time24h: 'HH:mm',
    time12h: 'hh:mm A',
    fullDateTime24h: 'D. MMMM YYYY HH:mm',
    fullDateTime12h: 'D. MMMM YYYY hh:mm A',
};

export const format = (date, fmt = 'YYYY-MM-DD HH:mm:ss') => toDayjs(date).format(fmt);

export const formatShortDate = (date) => toDayjs(date).format(DateFormats.shortDate);
export const formatLongDate = (date) => toDayjs(date).format(DateFormats.longDate);
export const formatTime24h = (date) => toDayjs(date).format(DateFormats.time24h);
export const formatTime12h = (date) => toDayjs(date).format(DateFormats.time12h);
export const formatFullDateTime24h = (date) => toDayjs(date).format(DateFormats.fullDateTime24h);
export const formatFullDateTime12h = (date) => toDayjs(date).format(DateFormats.fullDateTime12h);

// --------------------------
// 🕓 Relative Zeit
// --------------------------
export const fromNow = (date) => toDayjs(date).fromNow();
export const toNow = (date) => toDayjs(date).toNow();

// --------------------------
// 🧮 Berechnungen
// --------------------------
export const diff = (a, b, unit = 'milliseconds', float = false) =>
    toDayjs(a).diff(toDayjs(b), unit, float);

export const add = (date, amount, unit) => toDayjs(date).add(amount, unit);
export const subtract = (date, amount, unit) => toDayjs(date).subtract(amount, unit);

// --------------------------
// 🔍 Vergleiche
// --------------------------
export const isBefore = (a, b) => toDayjs(a).isBefore(toDayjs(b));
export const isAfter = (a, b) => toDayjs(a).isAfter(toDayjs(b));
export const isBetween = (t, start, end, inclusive = '()') =>
    toDayjs(t).isBetween(toDayjs(start), toDayjs(end), null, inclusive);

// --------------------------
// ⏱️ Dauer & Humanisierung
// --------------------------
export const durationMs = (ms) => dayjs.duration(ms);
export const humanizeDuration = (ms) => dayjs.duration(ms).humanize();

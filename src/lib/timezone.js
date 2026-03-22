function getDateTimePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value;

  return {
    year: Number(getPart('year')),
    month: Number(getPart('month')),
    day: Number(getPart('day')),
    hour: Number(getPart('hour')),
    minute: Number(getPart('minute')),
    second: Number(getPart('second'))
  };
}

function getTimeZoneOffsetMilliseconds(date, timeZone) {
  const zonedParts = getDateTimePartsInTimeZone(date, timeZone);
  const asUtcTimestamp = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute,
    zonedParts.second
  );
  return asUtcTimestamp - date.getTime();
}

function parseLocalDateTime(localDateTime) {
  if (typeof localDateTime !== 'string') {
    return null;
  }

  const match = localDateTime.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0)
  };
}

export function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getEffectiveTimeZone(configuredTimeZone) {
  if (isValidTimeZone(configuredTimeZone)) {
    return configuredTimeZone;
  }
  return getBrowserTimeZone();
}

export function zonedDateTimeToUtcDate(localDateTime, timeZone) {
  const parsed = parseLocalDateTime(localDateTime);
  if (!parsed || !isValidTimeZone(timeZone)) {
    return null;
  }

  const naiveUtcTimestamp = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second
  );

  let utcTimestamp = naiveUtcTimestamp;

  // Iterate to account for DST transitions around the selected wall time.
  for (let i = 0; i < 4; i += 1) {
    const offset = getTimeZoneOffsetMilliseconds(new Date(utcTimestamp), timeZone);
    const adjusted = naiveUtcTimestamp - offset;
    if (adjusted === utcTimestamp) {
      break;
    }
    utcTimestamp = adjusted;
  }

  return new Date(utcTimestamp);
}

export function formatDateTimeInTimeZone(dateLike, timeZone) {
  if (!dateLike) {
    return '';
  }

  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime()) || !isValidTimeZone(timeZone)) {
    return '';
  }

  return date.toLocaleString(undefined, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function getCurrentDateInputValueInTimeZone(timeZone) {
  if (!isValidTimeZone(timeZone)) {
    return new Date().toISOString().split('T')[0];
  }

  const now = new Date();
  const parts = getDateTimePartsInTimeZone(now, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getCurrentDateTimeInputValueInTimeZone(timeZone) {
  if (!isValidTimeZone(timeZone)) {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  const now = new Date();
  const parts = getDateTimePartsInTimeZone(now, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

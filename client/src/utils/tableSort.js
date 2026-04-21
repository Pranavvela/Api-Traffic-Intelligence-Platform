export function sortRows(rows, fields, direction = 'asc') {
  const selected = Array.isArray(fields) ? fields.filter(Boolean) : [];
  if (!Array.isArray(rows) || rows.length === 0 || selected.length === 0) {
    return rows;
  }

  const factor = direction === 'desc' ? -1 : 1;

  return [...rows].sort((leftRow, rightRow) => {
    for (const field of selected) {
      const leftValue = normalizeSortValue(getFieldValue(leftRow, field));
      const rightValue = normalizeSortValue(getFieldValue(rightRow, field));
      const comparison = compareValues(leftValue, rightValue);
      if (comparison !== 0) {
        return comparison * factor;
      }
    }

    return 0;
  });
}

export function getFieldValue(row, field) {
  if (typeof field === 'string') {
    return row?.[field];
  }

  if (field && typeof field.getValue === 'function') {
    return field.getValue(row);
  }

  return row?.[field?.key];
}

function normalizeSortValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.join(' ').toLowerCase();
  }

  if (value instanceof Date) {
    return String(value.getTime());
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (typeof value === 'string') {
    return normalizeSortString(value);
  }

  return String(value).toLowerCase();
}

function normalizeSortString(value) {
  const trimmed = value.trim();
  if (trimmed === '') {
    return '';
  }

  if (isNumericString(trimmed)) {
    return String(Number(trimmed));
  }

  return normalizeSortDateCandidate(trimmed);
}

function normalizeSortDateCandidate(value) {
  if (!isDateLikeString(value)) {
    return value.toLowerCase();
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value.toLowerCase();
  }

  return String(timestamp);
}

function compareValues(left, right) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function isNumericString(value) {
  return /^-?\d+(\.\d+)?$/.test(value);
}

function isDateLikeString(value) {
  return /[-/:T]/.test(value);
}
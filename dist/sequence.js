import { normalizedChances, pickWeightedIndex } from './core.js';
import { SCHEDULE } from './defaults.js';

const nameKey = name => name.trim().toLocaleLowerCase();

export function scheduledWinner(spinNumber, schedule = SCHEDULE) {
  return schedule.find(slot => slot.spin === spinNumber) ?? null;
}

export function chancesForSpin(entries, spinNumber, schedule = SCHEDULE) {
  if (!Number.isSafeInteger(spinNumber) || spinNumber < 1) throw new Error('Reset the spin counter before continuing.');
  const upcoming = schedule.filter(slot => slot.spin >= spinNumber);
  for (const slot of upcoming) {
    if (!entries.some(entry => nameKey(entry.name) === nameKey(slot.name))) {
      throw new Error(`Include ${slot.name} for spin ${slot.spin}, or restore the default list in Customize.`);
    }
  }
  const slot = scheduledWinner(spinNumber, schedule);
  if (slot) {
    const selected = entries.findIndex(entry => nameKey(entry.name) === nameKey(slot.name));
    return entries.map((_, index) => index === selected ? 1 : 0);
  }
  const reserved = new Set(upcoming.map(slot => nameKey(slot.name)));
  const eligible = entries.map(entry => ({ weight: reserved.has(nameKey(entry.name)) ? 0 : entry.weight }));
  return normalizedChances(eligible);
}

export function pickIndexForSpin(entries, spinNumber, randomValue, schedule = SCHEDULE) {
  const chances = chancesForSpin(entries, spinNumber, schedule);
  if (!chances.some(chance => chance > 0)) throw new Error('Give at least one available entry a positive weight. Scheduled names are reserved for their assigned spins.');
  return pickWeightedIndex(chances.map(weight => ({ weight })), randomValue);
}

export function entriesWithImages(defaultEntries, savedEntries = []) {
  const savedByName = new Map();
  for (const entry of savedEntries) {
    const key = nameKey(entry.name);
    if (!savedByName.has(key)) savedByName.set(key, []);
    savedByName.get(key).push(entry);
  }
  return defaultEntries.map(entry => {
    const previous = savedByName.get(nameKey(entry.name))?.shift();
    return { ...entry, ...(previous?.imageId ? { imageId: previous.imageId } : {}) };
  });
}

const { randomUUID } = require('node:crypto');

/**
 * In-memory data store.
 * Data resets whenever the server restarts. A later week replaces this
 * file with a real database while the controllers stay the same.
 */
const requests = new Map();

function seed() {
  const now = Date.now();
  const hoursAgo = (n) => new Date(now - n * 3600 * 1000).toISOString();

  const samples = [
    {
      name: 'Lerato Mokoena',
      email: 'lerato@example.com',
      category: 'application',
      subject: 'Help finishing my learnership application',
      description:
        'The form asks for a certified ID copy and I only have a photo. Can I upload that instead, or does it need to be a scan?',
      status: 'in_progress',
      createdAt: hoursAgo(30),
    },
    {
      name: 'Thabo Naidoo',
      email: 'thabo@example.com',
      category: 'opportunity',
      subject: 'Is the IT bursary still open for 2027?',
      description:
        'I found a bursary listing with a closing date that has passed. Is there a new intake, or has the listing just not been updated?',
      status: 'open',
      createdAt: hoursAgo(6),
    },
    {
      name: 'Aisha Peters',
      email: 'aisha@example.com',
      category: 'portal',
      subject: 'Cannot change my profile photo',
      description:
        'I upload a new picture but the old one keeps showing after I save. I have tried two browsers.',
      status: 'resolved',
      createdAt: hoursAgo(72),
    },
  ];

  samples.forEach((sample) => create(sample));
}

function create(data) {
  const timestamp = data.createdAt || new Date().toISOString();
  const record = {
    id: randomUUID(),
    status: 'open',
    ...data,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  requests.set(record.id, record);
  return record;
}

function findAll() {
  return [...requests.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function findById(id) {
  return requests.get(id) || null;
}

function update(id, changes) {
  const existing = requests.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...changes,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  requests.set(id, updated);
  return updated;
}

function remove(id) {
  return requests.delete(id);
}

function clear() {
  requests.clear();
}

module.exports = { seed, create, findAll, findById, update, remove, clear };

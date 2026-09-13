const { Op } = require('sequelize');
const crypto = require('crypto');
const {
  AllChat,
  AllChatMember,
  AllChatMessage,
  GroupChat,
  GroupChatMember,
  GroupChatMessage,
} = require('../models');

function classifyType(typeCond) {
  if (typeCond == null) return { wantAll: true, wantGroup: true, groupType: undefined };
  if (typeof typeCond === 'string') {
    if (typeCond === 'WARD') return { wantAll: true, wantGroup: false, groupType: undefined };
    return { wantAll: false, wantGroup: true, groupType: typeCond };
  }
  if (typeCond[Op.in]) {
    const list = typeCond[Op.in];
    const groupTypes = list.filter((t) => t !== 'WARD');
    return {
      wantAll: list.includes('WARD'),
      wantGroup: groupTypes.length > 0,
      groupType: groupTypes.length === 1 ? groupTypes[0] : { [Op.in]: groupTypes },
    };
  }
  return { wantAll: false, wantGroup: true, groupType: typeCond };
}

function splitWhere(where = {}) {
  const { type, nagarsevakUserId, ...rest } = where;
  const classif = classifyType(type);
  if (nagarsevakUserId !== undefined) classif.wantAll = false;
  const allWhere = { ...rest };
  const groupWhere = { ...rest };
  if (nagarsevakUserId !== undefined) groupWhere.nagarsevakUserId = nagarsevakUserId;
  if (classif.groupType !== undefined) groupWhere.type = classif.groupType;
  return { classif, allWhere, groupWhere };
}

function allIncludes(include) {
  return (include || []).filter((item) => item?.as !== 'nagarsevak');
}

function allAttributes(attributes) {
  if (!attributes) return attributes;
  return attributes.filter((name) => !['type', 'nagarsevakUserId', 'channel', 'chatKind'].includes(name));
}

function mark(row, kind) {
  if (!row) return null;
  row.chatKind = kind;
  const original = typeof row.toJSON === 'function' ? row.toJSON.bind(row) : () => ({ ...row });
  row.toJSON = function toJSON() {
    const json = original();
    json.type = json.type || (kind === 'all' ? 'WARD' : json.type);
    json.channel = kind === 'all' ? 'ALL' : 'GROUP';
    json.chatKind = kind;
    return json;
  };
  return row;
}

function stripAllValues(values = {}) {
  const next = { ...values };
  delete next.type;
  delete next.nagarsevakUserId;
  delete next.channel;
  delete next.chatKind;
  return next;
}

async function resolveKind(groupId) {
  if (!groupId) return null;
  if (await AllChat.findByPk(groupId, { attributes: ['id'] })) return 'all';
  if (await GroupChat.findByPk(groupId, { attributes: ['id'] })) return 'group';
  return null;
}

function modelsFor(kind) {
  return kind === 'all'
    ? { Chat: AllChat, Member: AllChatMember, Message: AllChatMessage }
    : { Chat: GroupChat, Member: GroupChatMember, Message: GroupChatMessage };
}

async function findByPk(id, options = {}) {
  const all = await AllChat.findByPk(id, {
    ...options,
    include: allIncludes(options.include),
    attributes: allAttributes(options.attributes),
  });
  if (all) return mark(all, 'all');
  const group = await GroupChat.findByPk(id, options);
  return mark(group, 'group');
}

async function findOne(options = {}) {
  const { classif, allWhere, groupWhere } = splitWhere(options.where || {});
  if (classif.wantAll) {
    const row = await AllChat.findOne({
      ...options,
      where: allWhere,
      include: allIncludes(options.include),
      attributes: allAttributes(options.attributes),
    });
    if (row) return mark(row, 'all');
  }
  if (classif.wantGroup) {
    const row = await GroupChat.findOne({ ...options, where: groupWhere });
    if (row) return mark(row, 'group');
  }
  return null;
}

async function findAll(options = {}) {
  const { classif, allWhere, groupWhere } = splitWhere(options.where || {});
  const { order, include, ...rest } = options;
  const rows = [];
  if (classif.wantAll) {
    const allRows = await AllChat.findAll({
      ...rest,
      where: allWhere,
      include: allIncludes(include),
      attributes: allAttributes(rest.attributes),
      order: [['name', 'ASC']],
    });
    rows.push(...allRows.map((row) => mark(row, 'all')));
  }
  if (classif.wantGroup) {
    const groupRows = await GroupChat.findAll({ ...rest, where: groupWhere, include, order: [['type', 'ASC'], ['name', 'ASC']] });
    rows.push(...groupRows.map((row) => mark(row, 'group')));
  }
  const rank = (row) => (row.type === 'WARD' ? 0 : row.type === 'NAGARSEVAK' ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || '')));
  return rows;
}

async function findOrCreate({ where, defaults = {}, ...rest }) {
  const { classif } = splitWhere(where || {});
  if (classif.wantAll && !classif.wantGroup) {
    const { type, nagarsevakUserId, ...allWhere } = where || {};
    const [row, created] = await AllChat.findOrCreate({
      where: allWhere,
      defaults: stripAllValues(defaults),
      ...rest,
    });
    return [mark(row, 'all'), created];
  }
  const [row, created] = await GroupChat.findOrCreate({ where, defaults, ...rest });
  return [mark(row, 'group'), created];
}

async function create(values, options) {
  if ((values?.type || 'CUSTOM') === 'WARD') {
    return mark(await AllChat.create(stripAllValues(values), options), 'all');
  }
  return mark(await GroupChat.create(values, options), 'group');
}

async function update(values, options = {}) {
  const { classif, allWhere, groupWhere } = splitWhere(options.where || {});
  let count = 0;
  if (classif.wantAll) {
    const [n] = await AllChat.update(stripAllValues(values), { ...options, where: allWhere });
    count += n;
  }
  if (classif.wantGroup) {
    const [n] = await GroupChat.update(values, { ...options, where: groupWhere });
    count += n;
  }
  return [count];
}

const Member = {
  async findOne(options = {}) {
    const groupId = options.where?.groupId;
    const kind = groupId ? await resolveKind(groupId) : null;
    if (kind === 'all') return AllChatMember.findOne(options);
    if (kind === 'group') return GroupChatMember.findOne(options);
    const all = await AllChatMember.findOne(options);
    if (all) return all;
    return GroupChatMember.findOne(options);
  },
  async findAll(options = {}) {
    const groupId = options.where?.groupId;
    const kind = groupId ? await resolveKind(groupId) : null;
    if (kind === 'all') return AllChatMember.findAll(options);
    if (kind === 'group') return GroupChatMember.findAll(options);
    const [allRows, groupRows] = await Promise.all([
      AllChatMember.findAll(options),
      GroupChatMember.findAll(options),
    ]);
    return [...allRows, ...groupRows];
  },
  async create(values, options) {
    const kind = await resolveKind(values?.groupId);
    const Model = modelsFor(kind || 'group').Member;
    return Model.create(values, options);
  },
  async bulkCreate(rows, options) {
    if (!rows?.length) return [];
    const kind = await resolveKind(rows[0].groupId);
    return modelsFor(kind || 'group').Member.bulkCreate(rows, options);
  },
  async destroy(options = {}) {
    const groupId = options.where?.groupId;
    const kind = groupId ? await resolveKind(groupId) : null;
    if (kind === 'all') return AllChatMember.destroy(options);
    if (kind === 'group') return GroupChatMember.destroy(options);
    const a = await AllChatMember.destroy(options);
    const b = await GroupChatMember.destroy(options);
    return a + b;
  },
  async update(values, options = {}) {
    const groupId = options.where?.groupId;
    const kind = groupId ? await resolveKind(groupId) : null;
    if (kind === 'all') return AllChatMember.update(values, options);
    if (kind === 'group') return GroupChatMember.update(values, options);
    const a = await AllChatMember.update(values, options);
    const b = await GroupChatMember.update(values, options);
    return [a[0] + b[0]];
  },
  async findOrCreate(options = {}) {
    const groupId = options.where?.groupId;
    const kind = await resolveKind(groupId);
    return modelsFor(kind || 'group').Member.findOrCreate(options);
  },
  async reconcile(groupId, allowedUserIds) {
    const allowed = [...new Set((allowedUserIds || []).filter(Boolean).map(String))];
    const existing = await Member.findAll({ where: { groupId }, attributes: ['id', 'userId'] });
    const existingIds = new Set(existing.map((row) => String(row.userId)));
    const allowedSet = new Set(allowed);
    const removed = existing.filter((row) => !allowedSet.has(String(row.userId)));
    if (removed.length) {
      await Member.destroy({
        where: { groupId, userId: { [Op.in]: removed.map((row) => row.userId) } },
      });
    }
    for (const userId of allowed) {
      if (!existingIds.has(userId)) {
        const kind = await resolveKind(groupId);
        const Model = modelsFor(kind || 'group').Member;
        try {
          await Model.create({ id: crypto.randomUUID(), groupId, userId, joinedAt: new Date() });
        } catch (error) {
          if (error?.name !== 'SequelizeUniqueConstraintError') throw error;
        }
      }
    }
  },
};

const Message = {
  async findOne(options = {}) {
    const groupId = options.where?.groupId;
    const kind = groupId ? await resolveKind(groupId) : null;
    if (kind === 'all') return AllChatMessage.findOne(options);
    if (kind === 'group') return GroupChatMessage.findOne(options);
    const all = await AllChatMessage.findOne(options);
    if (all) return all;
    return GroupChatMessage.findOne(options);
  },
  async findAll(options = {}) {
    const groupId = options.where?.groupId;
    const kind = groupId ? await resolveKind(groupId) : null;
    if (kind === 'all') return AllChatMessage.findAll(options);
    if (kind === 'group') return GroupChatMessage.findAll(options);
    const [allRows, groupRows] = await Promise.all([
      AllChatMessage.findAll(options),
      GroupChatMessage.findAll(options),
    ]);
    return [...allRows, ...groupRows];
  },
  async findByPk(id, options = {}) {
    const all = await AllChatMessage.findByPk(id, options);
    if (all) return all;
    return GroupChatMessage.findByPk(id, options);
  },
  async create(values, options) {
    const kind = await resolveKind(values?.groupId);
    return modelsFor(kind || 'group').Message.create(values, options);
  },
  async destroy(options = {}) {
    const a = await AllChatMessage.destroy(options);
    const b = await GroupChatMessage.destroy(options);
    return a + b;
  },
};

module.exports = {
  findByPk,
  findOne,
  findAll,
  findOrCreate,
  create,
  update,
  Member,
  Message,
  AllChat,
  AllChatMember,
  AllChatMessage,
  GroupChat,
  GroupChatMember,
  GroupChatMessage,
  resolveKind,
};

const { Op } = require('sequelize');
const { NagarsevakSchedule, User, Role, Ward, Employee } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { notifyUser } = require('../../services/notify.service');
const { isWardAllowed, allowedWardIds } = require('../services/wardScope');

const CATEGORIES = ['VISIT', 'MEETING', 'INSPECTION', 'EVENT', 'CITIZEN_HEARING', 'OTHER'];
const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function getKolkataDateString(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

function shiftIsoDate(isoDate, days) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function getKolkataOffsetDateString(offsetDays = 0) {
  return shiftIsoDate(getKolkataDateString(), offsetDays);
}

function getMonthRangeStrings(d = new Date()) {
  const todayStr = getKolkataDateString(d);
  const [y, m] = todayStr.split('-');
  const firstDay = `${y}-${m}-01`;
  const lastDay = new Date(Date.UTC(Number(y), Number(m), 0)).toISOString().slice(0, 10);
  return { firstDay, lastDay };
}

function getWeekRangeStrings(d = new Date()) {
  const todayStr = getKolkataDateString(d);
  const [y, m, day] = todayStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, day));
  const dayOfWeek = utc.getUTCDay();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = shiftIsoDate(todayStr, -distanceToMonday);
  const endOfWeek = shiftIsoDate(startOfWeek, 6);
  return { startOfWeek, endOfWeek };
}

function getLastWeekRangeStrings(d = new Date()) {
  const { startOfWeek } = getWeekRangeStrings(d);
  const startOfLastWeek = shiftIsoDate(startOfWeek, -7);
  const endOfLastWeek = shiftIsoDate(startOfLastWeek, 6);
  return { startOfLastWeek, endOfLastWeek };
}

async function resolveNagarsevakForUser(req, requestedNagarId = null) {
  const role = req.user.roleName;
  if (role === 'NAGARSEVAK') {
    return req.user.id;
  }
  if (role === 'EMPLOYEE') {
    // Employee can ONLY schedule for their own managing Nagarsevak
    if (req.user.employeeProfile?.managerUserId) {
      return req.user.employeeProfile.managerUserId;
    }
    const nagarRole = await Role.findOne({ where: { name: 'NAGARSEVAK' } });
    if (nagarRole && req.user.wardId) {
      const activeNagar = await User.findOne({
        where: { roleId: nagarRole.id, wardId: req.user.wardId, status: 'ACTIVE' },
        attributes: ['id'],
      });
      if (activeNagar) return activeNagar.id;
    }
    return null;
  }
  if (requestedNagarId) return requestedNagarId;
  return null;
}

/** Nagarsevak, creator, master, or employee working under that Nagarsevak / same ward. */
async function canManageScheduleItem(req, item) {
  const role = req.user.roleName;
  if (['SUPER_ADMIN', 'SUB_MASTER_ADMIN'].includes(role)) return true;
  if (String(item.nagarsevakUserId) === String(req.user.id)) return true;
  if (String(item.createdByUserId) === String(req.user.id)) return true;
  if (role === 'EMPLOYEE') {
    const nagarId = await resolveNagarsevakForUser(req);
    if (nagarId && String(item.nagarsevakUserId) === String(nagarId)) return true;
    if (req.user.wardId && item.wardId && String(item.wardId) === String(req.user.wardId)) return true;
  }
  return false;
}

// Automatically delete schedules older than 30 days (1 month past retention policy)
async function autoDeletePastMonthSchedules() {
  try {
    const todayStr = getKolkataDateString();
    const thirtyDaysAgo = shiftIsoDate(todayStr, -30);
    await NagarsevakSchedule.destroy({
      where: {
        scheduledDate: { [Op.lt]: thirtyDaysAgo },
      },
      force: true,
    });
  } catch (err) {
    // Non-blocking
    console.error('Auto-delete past month schedules error:', err.message);
  }
}

const list = asyncHandler(async (req, res) => {
  // Purge schedules older than a month in background
  autoDeletePastMonthSchedules().catch(() => {});

  const role = req.user.roleName;
  const todayStr = getKolkataDateString();
  const yesterdayStr = getKolkataOffsetDateString(-1);
  const tomorrowStr = getKolkataOffsetDateString(1);
  const { firstDay: monthStart, lastDay: monthEnd } = getMonthRangeStrings();
  const { startOfWeek, endOfWeek } = getWeekRangeStrings();
  const { startOfLastWeek, endOfLastWeek } = getLastWeekRangeStrings();

  const where = {};
  const baseScopeWhere = {};

  // Role scoping
  if (role === 'NAGARSEVAK') {
    where.nagarsevakUserId = req.user.id;
    baseScopeWhere.nagarsevakUserId = req.user.id;
  } else if (role === 'EMPLOYEE') {
    const nagarId = await resolveNagarsevakForUser(req, req.query.nagarsevakUserId);
    if (nagarId) {
      where[Op.or] = [
        { nagarsevakUserId: nagarId },
        { createdByUserId: req.user.id },
      ];
      baseScopeWhere[Op.or] = [
        { nagarsevakUserId: nagarId },
        { createdByUserId: req.user.id },
      ];
    } else if (req.user.wardId) {
      where[Op.or] = [
        { wardId: req.user.wardId },
        { createdByUserId: req.user.id },
      ];
      baseScopeWhere[Op.or] = [
        { wardId: req.user.wardId },
        { createdByUserId: req.user.id },
      ];
    } else {
      where.createdByUserId = req.user.id;
      baseScopeWhere.createdByUserId = req.user.id;
    }
  } else {
    // Master or SubMaster
    if (req.query.nagarsevakUserId) {
      where.nagarsevakUserId = req.query.nagarsevakUserId;
      baseScopeWhere.nagarsevakUserId = req.query.nagarsevakUserId;
    }
    if (req.query.wardId) {
      if (!isWardAllowed(req, req.query.wardId)) throw new ApiError(403, 'Ward access denied');
      where.wardId = req.query.wardId;
      baseScopeWhere.wardId = req.query.wardId;
    } else {
      const allowed = allowedWardIds(req);
      if (allowed !== null) {
        where.wardId = { [Op.in]: allowed.length ? allowed : ['00000000-0000-0000-0000-000000000000'] };
        baseScopeWhere.wardId = where.wardId;
      }
    }
  }

  // Filter preset
  const preset = req.query.filterPreset || (req.query.date ? 'custom' : 'today');
  if (preset === 'today') {
    where.scheduledDate = todayStr;
  } else if (preset === 'yesterday_remaining') {
    // Specifically requested by user: yesterday's remaining work
    where.scheduledDate = yesterdayStr;
    where.status = { [Op.in]: ['PENDING', 'IN_PROGRESS'] };
  } else if (preset === 'yesterday') {
    where.scheduledDate = yesterdayStr;
  } else if (preset === 'overdue') {
    // All past dates remaining
    where.scheduledDate = { [Op.lt]: todayStr };
    where.status = { [Op.in]: ['PENDING', 'IN_PROGRESS'] };
  } else if (preset === 'tomorrow') {
    where.scheduledDate = tomorrowStr;
  } else if (preset === 'week') {
    where.scheduledDate = { [Op.between]: [startOfWeek, endOfWeek] };
  } else if (preset === 'week_done') {
    where.scheduledDate = { [Op.between]: [startOfWeek, endOfWeek] };
    where.status = 'COMPLETED';
  } else if (preset === 'week_remaining') {
    where.scheduledDate = { [Op.between]: [startOfWeek, endOfWeek] };
    where.status = { [Op.in]: ['PENDING', 'IN_PROGRESS'] };
  } else if (preset === 'last_week') {
    where.scheduledDate = { [Op.between]: [startOfLastWeek, endOfLastWeek] };
  } else if (preset === 'last_week_done') {
    where.scheduledDate = { [Op.between]: [startOfLastWeek, endOfLastWeek] };
    where.status = 'COMPLETED';
  } else if (preset === 'month') {
    where.scheduledDate = { [Op.between]: [monthStart, monthEnd] };
  } else if (preset === 'month_done') {
    where.scheduledDate = { [Op.between]: [monthStart, monthEnd] };
    where.status = 'COMPLETED';
  } else if (preset === 'month_remaining') {
    where.scheduledDate = { [Op.between]: [monthStart, monthEnd] };
    where.status = { [Op.in]: ['PENDING', 'IN_PROGRESS'] };
  } else if (preset === 'all') {
    // no date filter
  } else if (req.query.date) {
    where.scheduledDate = req.query.date;
  } else if (req.query.startDate && req.query.endDate) {
    where.scheduledDate = { [Op.between]: [req.query.startDate, req.query.endDate] };
  }

  // Explicit status filter (can override preset status if user clicks a status filter)
  if (req.query.status) {
    if (req.query.status === 'INCOMPLETE') {
      where.status = { [Op.in]: ['PENDING', 'IN_PROGRESS'] };
    } else if (STATUSES.includes(req.query.status)) {
      where.status = req.query.status;
    }
  }

  if (req.query.priority && PRIORITIES.includes(req.query.priority)) {
    where.priority = req.query.priority;
  }

  if (req.query.category && CATEGORIES.includes(req.query.category)) {
    where.category = req.query.category;
  }

  if (req.query.createdByType === 'SELF' && role === 'NAGARSEVAK') {
    where.createdByUserId = req.user.id;
  } else if (req.query.createdByType === 'EMPLOYEE' && role === 'NAGARSEVAK') {
    where.createdByUserId = { [Op.ne]: req.user.id };
  }

  const search = String(req.query.search || '').trim();
  if (search) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { location: { [Op.like]: `%${search}%` } },
          { '$creator.name$': { [Op.like]: `%${search}%` } },
        ],
      },
    ];
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = (page - 1) * limit;

  const include = [
    { model: User, as: 'creator', attributes: ['id', 'name', 'mobile', 'email', 'roleId'], include: [{ model: Role, attributes: ['name'] }] },
    { model: User, as: 'nagarsevak', attributes: ['id', 'name', 'mobile'] },
    { model: User, as: 'completedBy', attributes: ['id', 'name', 'mobile'] },
    { model: Ward, as: 'ward', attributes: ['id', 'wardNumber', 'name'] },
  ];

  const order = [
    ['scheduled_date', 'ASC'],
    ['scheduled_time', 'ASC'],
    ['created_at', 'ASC'],
  ];

  const { rows, count } = await NagarsevakSchedule.findAndCountAll({
    where,
    include,
    order,
    limit,
    offset,
    distinct: true,
  });

  // Calculate summary counts for quick navigation cards and reports
  const [
    todayTotal,
    todayPending,
    todayCompleted,
    yesterdayTotal,
    yesterdayRemaining,
    yesterdayCompleted,
    weekTotal,
    weekCompleted,
    weekPending,
    lastWeekTotal,
    lastWeekCompleted,
    lastWeekPending,
    monthTotal,
    monthCompleted,
    monthRemaining,
    overdueRemaining,
  ] = await Promise.all([
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: todayStr } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: todayStr, status: { [Op.in]: ['PENDING', 'IN_PROGRESS'] } } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: todayStr, status: 'COMPLETED' } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: yesterdayStr } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: yesterdayStr, status: { [Op.in]: ['PENDING', 'IN_PROGRESS'] } } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: yesterdayStr, status: 'COMPLETED' } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: { [Op.between]: [startOfWeek, endOfWeek] } } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: { [Op.between]: [startOfWeek, endOfWeek] }, status: 'COMPLETED' } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: { [Op.between]: [startOfWeek, endOfWeek] }, status: { [Op.in]: ['PENDING', 'IN_PROGRESS'] } } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: { [Op.between]: [startOfLastWeek, endOfLastWeek] } } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: { [Op.between]: [startOfLastWeek, endOfLastWeek] }, status: 'COMPLETED' } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: { [Op.between]: [startOfLastWeek, endOfLastWeek] }, status: { [Op.in]: ['PENDING', 'IN_PROGRESS'] } } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: { [Op.between]: [monthStart, monthEnd] } } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: { [Op.between]: [monthStart, monthEnd] }, status: 'COMPLETED' } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: { [Op.between]: [monthStart, monthEnd] }, status: { [Op.in]: ['PENDING', 'IN_PROGRESS'] } } }),
    NagarsevakSchedule.count({ where: { ...baseScopeWhere, scheduledDate: { [Op.lt]: todayStr }, status: { [Op.in]: ['PENDING', 'IN_PROGRESS'] } } }),
  ]);

  return success(res, {
    data: rows,
    meta: {
      total: count,
      page,
      limit,
      pages: Math.max(1, Math.ceil(count / limit)),
      summary: {
        todayTotal,
        todayPending,
        todayCompleted,
        yesterdayTotal,
        yesterdayRemaining,
        yesterdayCompleted,
        weekTotal,
        weekCompleted,
        weekPending,
        lastWeekTotal,
        lastWeekCompleted,
        lastWeekPending,
        monthTotal,
        monthCompleted,
        monthRemaining,
        overdueRemaining,
        todayStr,
        yesterdayStr,
        tomorrowStr,
        startOfWeek,
        endOfWeek,
        startOfLastWeek,
        endOfLastWeek,
        monthStart,
        monthEnd,
      },
    },
  });
});

const create = asyncHandler(async (req, res) => {
  // Purge past month data asynchronously
  autoDeletePastMonthSchedules().catch(() => {});

  const {
    title,
    description,
    scheduledDate,
    scheduledTime,
    location,
    category = 'VISIT',
    priority = 'MEDIUM',
    nagarsevakUserId: requestedNagarId,
  } = req.body;

  if (!String(title || '').trim()) throw new ApiError(400, 'Title/Work description is required');
  if (!scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) throw new ApiError(400, 'Valid scheduled date (YYYY-MM-DD) is required');
  if (category && !CATEGORIES.includes(category)) throw new ApiError(400, 'Invalid schedule category');
  if (priority && !PRIORITIES.includes(priority)) throw new ApiError(400, 'Invalid priority level');

  const role = req.user.roleName;
  let targetNagarId = null;
  let wardId = req.user.wardId || null;

  if (role === 'NAGARSEVAK') {
    targetNagarId = req.user.id;
  } else if (role === 'EMPLOYEE') {
    targetNagarId = await resolveNagarsevakForUser(req, requestedNagarId);
    if (!targetNagarId) {
      throw new ApiError(400, 'Could not determine the Nagarsevak for this ward. Please select a Nagarsevak.');
    }
  } else if (['SUPER_ADMIN', 'SUB_MASTER_ADMIN'].includes(role)) {
    if (!requestedNagarId) throw new ApiError(400, 'Nagarsevak selection is required');
    targetNagarId = requestedNagarId;
  } else {
    throw new ApiError(403, 'Permission denied to add schedule items');
  }

  const nagar = await User.findByPk(targetNagarId, { attributes: ['id', 'name', 'wardId'] });
  if (!nagar) throw new ApiError(404, 'Nagarsevak not found');
  if (!wardId && nagar.wardId) wardId = nagar.wardId;

  const item = await NagarsevakSchedule.create({
    nagarsevakUserId: targetNagarId,
    createdByUserId: req.user.id,
    wardId,
    title: title.trim(),
    description: description ? description.trim() : null,
    scheduledDate,
    scheduledTime: scheduledTime ? scheduledTime.trim() : null,
    location: location ? location.trim() : null,
    category,
    priority,
    status: 'PENDING',
  });

  // Notifications: Alert Nagarsevak if added by staff, or alert ward employees if added by Nagarsevak
  if (targetNagarId && targetNagarId !== req.user.id) {
    await notifyUser({
      userId: targetNagarId,
      type: 'SCHEDULE_NEW',
      title: 'New Daily Schedule Added',
      message: `${req.user.name || 'Ward staff'} added a schedule item for ${scheduledDate}: "${item.title}"`,
      senderUserId: req.user.id,
      actionUrl: '/schedules',
      channel: 'IN_APP',
    }).catch(() => {});
  } else if (role === 'NAGARSEVAK' && wardId) {
    try {
      const empRole = await Role.findOne({ where: { name: 'EMPLOYEE' } });
      if (empRole) {
        const wardEmps = await User.findAll({
          where: { roleId: empRole.id, wardId, status: 'ACTIVE' },
          attributes: ['id'],
        });
        for (const emp of wardEmps) {
          notifyUser({
            userId: emp.id,
            type: 'SCHEDULE_NEW',
            title: 'Nagarsevak Scheduled Work',
            message: `${req.user.name} scheduled: "${item.title}" for ${scheduledDate}${scheduledTime ? ` at ${scheduledTime}` : ''}`,
            senderUserId: req.user.id,
            actionUrl: '/schedules',
            channel: 'IN_APP',
          }).catch(() => {});
        }
      }
    } catch (_) {}
  }

  const full = await NagarsevakSchedule.findByPk(item.id, {
    include: [
      { model: User, as: 'creator', attributes: ['id', 'name', 'mobile', 'email', 'roleId'], include: [{ model: Role, attributes: ['name'] }] },
      { model: User, as: 'nagarsevak', attributes: ['id', 'name', 'mobile'] },
      { model: Ward, as: 'ward', attributes: ['id', 'wardNumber', 'name'] },
    ],
  });

  return success(res, { statusCode: 201, data: full, message: 'Schedule item added successfully' });
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status, completionNote } = req.body;
  if (!STATUSES.includes(status)) throw new ApiError(400, 'Invalid status');

  const item = await NagarsevakSchedule.findByPk(req.params.id, {
    include: [
      { model: User, as: 'creator', attributes: ['id', 'name'] },
      { model: User, as: 'nagarsevak', attributes: ['id', 'name'] },
    ],
  });
  if (!item) throw new ApiError(404, 'Schedule item not found');

  if (!(await canManageScheduleItem(req, item))) {
    throw new ApiError(403, 'You do not have permission to update this schedule');
  }

  const prevStatus = item.status;
  const isCompleted = status === 'COMPLETED';
  await item.update({
    status,
    completedAt: isCompleted ? (item.completedAt || new Date()) : null,
    completedByUserId: isCompleted ? req.user.id : null,
    completionNote: completionNote !== undefined ? (completionNote ? completionNote.trim() : null) : item.completionNote,
  });

  // Bidirectional notifications when marked Completed or Reopened
  if (isCompleted) {
    // If staff marked it, notify the Nagarsevak
    if (req.user.id !== item.nagarsevakUserId && item.nagarsevakUserId) {
      await notifyUser({
        userId: item.nagarsevakUserId,
        type: 'SCHEDULE_COMPLETED',
        title: 'Schedule Work Completed',
        message: `${req.user.name || 'Ward staff'} marked "${item.title}" as completed${completionNote ? `: "${completionNote}"` : ''}.`,
        senderUserId: req.user.id,
        actionUrl: '/schedules',
        channel: 'IN_APP',
      }).catch(() => {});
    }
    // If Nagarsevak marked it, notify creator staff if different
    if (item.createdByUserId && item.createdByUserId !== req.user.id && item.createdByUserId !== item.nagarsevakUserId) {
      await notifyUser({
        userId: item.createdByUserId,
        type: 'SCHEDULE_COMPLETED',
        title: 'Schedule Work Completed',
        message: `${req.user.name || 'Nagarsevak'} marked "${item.title}" as completed.`,
        senderUserId: req.user.id,
        actionUrl: '/schedules',
        channel: 'IN_APP',
      }).catch(() => {});
    }
  } else if (prevStatus === 'COMPLETED' && status !== 'COMPLETED') {
    // Reopened
    const notifyTarget = req.user.id === item.nagarsevakUserId ? item.createdByUserId : item.nagarsevakUserId;
    if (notifyTarget && notifyTarget !== req.user.id) {
      await notifyUser({
        userId: notifyTarget,
        type: 'SCHEDULE_UPDATED',
        title: 'Schedule Task Reopened',
        message: `${req.user.name} reopened the task: "${item.title}".`,
        senderUserId: req.user.id,
        actionUrl: '/schedules',
        channel: 'IN_APP',
      }).catch(() => {});
    }
  }

  const full = await NagarsevakSchedule.findByPk(item.id, {
    include: [
      { model: User, as: 'creator', attributes: ['id', 'name', 'mobile', 'email', 'roleId'], include: [{ model: Role, attributes: ['name'] }] },
      { model: User, as: 'nagarsevak', attributes: ['id', 'name', 'mobile'] },
      { model: User, as: 'completedBy', attributes: ['id', 'name', 'mobile'] },
      { model: Ward, as: 'ward', attributes: ['id', 'wardNumber', 'name'] },
    ],
  });

  return success(res, { data: full, message: `Schedule marked as ${status.toLowerCase()}` });
});

const update = asyncHandler(async (req, res) => {
  const item = await NagarsevakSchedule.findByPk(req.params.id);
  if (!item) throw new ApiError(404, 'Schedule item not found');

  if (!(await canManageScheduleItem(req, item))) {
    throw new ApiError(403, 'You do not have permission to edit this schedule item');
  }

  const { title, description, scheduledDate, scheduledTime, location, category, priority } = req.body;
  const updates = {};
  if (title !== undefined) updates.title = String(title).trim();
  if (description !== undefined) updates.description = description ? String(description).trim() : null;
  if (scheduledDate !== undefined) updates.scheduledDate = scheduledDate;
  if (scheduledTime !== undefined) updates.scheduledTime = scheduledTime ? String(scheduledTime).trim() : null;
  if (location !== undefined) updates.location = location ? String(location).trim() : null;
  if (category !== undefined && CATEGORIES.includes(category)) updates.category = category;
  if (priority !== undefined && PRIORITIES.includes(priority)) updates.priority = priority;

  const oldDate = item.scheduledDate;
  await item.update(updates);

  // If date was changed (e.g. moved to today or rescheduled), notify the other party
  if (updates.scheduledDate && updates.scheduledDate !== oldDate) {
    const notifyTarget = req.user.id === item.nagarsevakUserId ? item.createdByUserId : item.nagarsevakUserId;
    if (notifyTarget && notifyTarget !== req.user.id) {
      await notifyUser({
        userId: notifyTarget,
        type: 'SCHEDULE_UPDATED',
        title: 'Schedule Item Rescheduled',
        message: `${req.user.name} rescheduled "${item.title}" to ${updates.scheduledDate}.`,
        senderUserId: req.user.id,
        actionUrl: '/schedules',
        channel: 'IN_APP',
      }).catch(() => {});
    }
  }

  const full = await NagarsevakSchedule.findByPk(item.id, {
    include: [
      { model: User, as: 'creator', attributes: ['id', 'name', 'mobile', 'email', 'roleId'], include: [{ model: Role, attributes: ['name'] }] },
      { model: User, as: 'nagarsevak', attributes: ['id', 'name', 'mobile'] },
      { model: User, as: 'completedBy', attributes: ['id', 'name', 'mobile'] },
      { model: Ward, as: 'ward', attributes: ['id', 'wardNumber', 'name'] },
    ],
  });

  return success(res, { data: full, message: 'Schedule updated successfully' });
});

const remove = asyncHandler(async (req, res) => {
  const item = await NagarsevakSchedule.findByPk(req.params.id);
  if (!item) throw new ApiError(404, 'Schedule item not found');

  if (!(await canManageScheduleItem(req, item))) {
    throw new ApiError(403, 'You do not have permission to delete this schedule item');
  }

  await item.destroy();
  return success(res, { message: 'Schedule item deleted successfully' });
});

module.exports = {
  list,
  create,
  update,
  updateStatus,
  remove,
  getKolkataDateString,
  getKolkataOffsetDateString,
  getMonthRangeStrings,
  getWeekRangeStrings,
  getLastWeekRangeStrings,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
};

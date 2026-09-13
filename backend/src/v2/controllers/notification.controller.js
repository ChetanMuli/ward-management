const { Op } = require('sequelize');
const { Notification, User, Role, Employee, Scheme, Person, Family, House, Area, Ward } = require('../../models');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');

const list = asyncHandler(async (req,res)=>{
  const [receivedRows,sentRows]=await Promise.all([
    Notification.findAll({
      where:{userId:req.user.id},
      include:[{model:User,as:'sender',attributes:['id','name','email','mobile'],include:[{model:Role,attributes:['id','name']}] }],
      order:[['createdAt','DESC']],
      limit:250,
    }),
    Notification.findAll({
      where:{senderUserId:req.user.id},
      include:[{model:User,as:'recipient',attributes:['id','name','email','mobile'],include:[{model:Role,attributes:['id','name']}] }],
      order:[['createdAt','DESC']],
      limit:200,
    })
  ]);

  let received=receivedRows.map(row=>{
    const x=row.toJSON();
    if(x.sender){
      x.sender.roleName=x.sender.Role?.name||null;
      delete x.sender.Role;
    }
    x.direction='RECEIVED';
    return x;
  });
  if(req.user.roleName==='CITIZEN' && req.user.wardId){
    const { getVisibleNagarsevakIds } = require('../../services/wardActivation.service');
    const visible=new Set((await getVisibleNagarsevakIds(req.user.wardId)).map(String));
    received=received.filter(n=>{
      const type=String(n.type||'').toUpperCase();
      if(type.startsWith('COMPLAINT')) return true;
      if(type==='NAGARSEVAK_ACTIVATED') return true;
      if(n.sender?.roleName==='NAGARSEVAK' && n.sender?.id && !visible.has(String(n.sender.id))) return false;
      return true;
    });
  }

  const sentGroups=new Map();
  for(const row of sentRows){
    const x=row.toJSON();
    const sentAt=x.sentAt||x.createdAt;
    const key=[x.type,x.title,x.message,sentAt?new Date(sentAt).getTime():x.createdAt].join('|');
    if(!sentGroups.has(key)){
      sentGroups.set(key,{
        ...x,
        id:`sent-${x.id}`,
        direction:'SENT',
        isRead:true,
        recipientCount:0,
        recipientNames:[]
      });
    }
    const g=sentGroups.get(key);
    g.recipientCount+=1;
    if(x.recipient?.name && g.recipientNames.length<8) g.recipientNames.push(x.recipient.name);
    delete g.recipient;
  }

  const data=[...received,...sentGroups.values()]
    .sort((a,b)=>new Date(b.sentAt||b.createdAt)-new Date(a.sentAt||a.createdAt))
    .slice(0,150);

  return success(res,{data});
});
const markAllRead = asyncHandler(async(req,res)=>{
  await Notification.update({isRead:true},{where:{userId:req.user.id,isRead:false}});
  return success(res,{message:'All notifications marked as read'});
});
const clearAll = asyncHandler(async(req,res)=>{
  await Notification.destroy({where:{userId:req.user.id}});
  return success(res,{message:'Notifications cleared'});
});

const markRead = asyncHandler(async(req,res)=>{
  const row=await Notification.findOne({where:{id:req.params.id,userId:req.user.id}});
  if(row) await row.update({isRead:true});
  return success(res,{message:'Notification marked as read'});
});

const roleUsers = async (roleName, req, wardId = null) => {
  const r = await Role.findOne({ where: { name: roleName } });
  if (!r) return [];
  const where = { roleId: r.id, status: 'ACTIVE' };
  if (wardId) where.wardId = wardId;
  return User.findAll({
    where,
    attributes: ['id','name','email','mobile','wardId'],
    include: [{ model: Role, attributes: ['id','name'] }, { model: Ward, as: 'ward', attributes: ['id','wardNumber','name'] }]
  });
};

const citizenUsersForWard = async (wardId) => {
  const citizenRole = await Role.findOne({ where: { name: 'CITIZEN' } });
  if (!citizenRole) return [];
  return User.findAll({
    where: { status: 'ACTIVE', roleId: citizenRole.id, wardId },
    attributes: ['id','name','email','mobile','wardId'],
    include: [{ model: Role, attributes: ['id','name'] }, { model: Ward, as: 'ward', attributes: ['id','wardNumber','name'] }]
  });
};

const recipients = asyncHandler(async (req,res) => {
  const audience = String(req.query.audience || '').toUpperCase();
  const requestedWardId = String(req.query.wardId || '').trim() || null;

  if (req.user.roleName === 'SUPER_ADMIN') {
    if (!['NAGARSEVAK','EMPLOYEE'].includes(audience)) {
      throw new ApiError(400, 'Master Admin can select Nagarsevak or Employee recipients');
    }
    const users = await roleUsers(audience, req, requestedWardId);
    return success(res, { data: users.map(u => ({
      id:u.id,name:u.name,email:u.email,mobile:u.mobile,wardId:u.wardId,
      ward:u.ward,roleName:u.Role?.name||audience
    })) });
  }

  if (req.user.roleName === 'NAGARSEVAK') {
    if (audience === 'MASTER_ADMIN') {
      const users = await roleUsers('SUPER_ADMIN', req, null);
      return success(res, { data: users.map(u => ({
        id:u.id,name:u.name,email:u.email,mobile:u.mobile,wardId:u.wardId,
        ward:u.ward,roleName:'SUPER_ADMIN'
      })) });
    }
    if (audience !== 'CITIZEN') throw new ApiError(403, 'Nagarsevak can send messages only to residents of the assigned ward');
    const users = await citizenUsersForWard(req.user.wardId);
    return success(res, { data: users.map(u => ({
      id:u.id,name:u.name,email:u.email,mobile:u.mobile,wardId:u.wardId,
      ward:u.person?.family?.house?.area?.ward||null,roleName:'CITIZEN'
    })) });
  }

  throw new ApiError(403, 'You do not have permission to send messages');
});

const send = asyncHandler(async(req,res)=>{
  const title=String(req.body.title||'').trim();
  const message=String(req.body.message||'').trim();
  if(!title) throw new ApiError(400,'Message title is required');
  if(!message) throw new ApiError(400,'Message is required');

  const audience=String(req.body.audience||'').toUpperCase();
  const targetWardId=String(req.body.targetWardId||'').trim()||null;
  const requestedIds=Array.isArray(req.body.targetUserIds)?[...new Set(req.body.targetUserIds.map(String).filter(Boolean))]:[];
  let users=[];

  if(req.user.roleName==='SUPER_ADMIN'){
    if(!['NAGARSEVAK','EMPLOYEE'].includes(audience)) throw new ApiError(400,'Select Nagarsevak or Employee as the recipient type');
    const available=await roleUsers(audience,req,targetWardId);
    if(requestedIds.length) users=available.filter(u=>requestedIds.includes(u.id));
    else if(req.body.selectAll===true) users=available;
    else throw new ApiError(400,'Select recipients or choose Send to all shown');
  } else if(req.user.roleName==='NAGARSEVAK'){
    if(audience==='MASTER_ADMIN'){
      if(targetWardId) throw new ApiError(400,'Ward selection is not used when messaging the Master Admin');
      const available=await roleUsers('SUPER_ADMIN',req,null);
      if(requestedIds.length) users=available.filter(u=>requestedIds.includes(u.id));
      else if(req.body.selectAll===true) users=available;
      else throw new ApiError(400,'Select a Master Admin or choose Send to all Master Admins');
    } else {
      if(audience!=='CITIZEN') throw new ApiError(403,'Nagarsevak can message residents only');
      if(targetWardId && targetWardId!==String(req.user.wardId)) throw new ApiError(403,'You can send messages only to your ward');
      const available=await citizenUsersForWard(req.user.wardId);
      if(requestedIds.length) users=available.filter(u=>requestedIds.includes(u.id));
      else if(req.body.selectAll===true) users=available;
      else throw new ApiError(400,'Select residents or choose Send to all ward residents');
    }
  } else {
    throw new ApiError(403,'You do not have permission to send messages');
  }

  users=users.filter(u=>u.id!==req.user.id);
  if(!users.length) throw new ApiError(400,'No active recipients were found');
  const { notifyUsers } = require('../../services/notify.service');
  await notifyUsers(users.map(u=>u.id), {
    senderUserId: req.user.id,
    type: 'DIRECT_MESSAGE',
    title,
    message,
    actionUrl: '/groups',
  });
  return success(res,{message:`Message sent to ${users.length} recipient${users.length===1?'':'s'}`,data:{recipientCount:users.length}});
});

const schemeRecipients = asyncHandler(async(req,res)=>{
  const schemeId=String(req.query.schemeId||'').trim();
  const scheme=schemeId?await Scheme.findByPk(schemeId,{include:[{model:Ward,as:'ward',attributes:['id','wardNumber','name']}] }):null;
  if(!scheme) throw new ApiError(404,'Scheme not found');
  if(scheme.status!=='PUBLISHED') throw new ApiError(400,'Only published schemes can have notifications');
  const schemeWardId=String(scheme.wardId||scheme.ward?.id||'').trim();
  if(!schemeWardId) throw new ApiError(400,'This scheme has no publishing ward');
  if(req.user.roleName==='NAGARSEVAK' && String(schemeWardId)!==String(req.user.wardId))
    throw new ApiError(403,'You can notify only your ward');
  const users=await citizenUsersForWard(schemeWardId);
  return success(res,{data:users.map(u=>({
    id:u.id,name:u.name,email:u.email,mobile:u.mobile,wardId:u.wardId,ward:u.ward||null
  }))});
});

const sendScheme = asyncHandler(async(req,res)=>{
  if(!['SUPER_ADMIN','NAGARSEVAK'].includes(req.user.roleName)) throw new ApiError(403,'Only the Master Admin or Nagarsevak can send scheme notifications');

  const scheme=await Scheme.findByPk(req.body.schemeId,{include:[{model:Ward,as:'ward',attributes:['id','wardNumber','name']}]});
  if(!scheme) throw new ApiError(404,'Scheme not found');
  if(scheme.status!=='PUBLISHED') throw new ApiError(400,'Only published schemes can send notifications');

  const schemeWardId=String(scheme.wardId||scheme.ward?.id||'').trim();
  if(!schemeWardId) throw new ApiError(400,'This scheme has no publishing ward. Edit the scheme and select its ward first.');

  if(req.user.roleName==='NAGARSEVAK' && String(req.user.wardId)!==schemeWardId) throw new ApiError(403,'You can notify only schemes published in your ward');

  const requestedWardId=String(req.body.targetWardId||'').trim();
  if(requestedWardId && requestedWardId!==schemeWardId) throw new ApiError(400,'This scheme can notify only its publishing ward');
  const targetWardId=schemeWardId;

  const citizenRole=await Role.findOne({where:{name:'CITIZEN'}});
  if(!citizenRole) throw new ApiError(400,'Citizen role is not configured');

  const users=await citizenUsersForWard(targetWardId);
  const eligible=users;
  if(!eligible.length) throw new ApiError(400,'No active citizen accounts are linked to the scheme publishing ward');

  const title=String(req.body.title||`Scheme: ${scheme.title}`).trim();
  const message=String(req.body.message||`${scheme.title} has been published. Please review its eligibility and details.`).trim();
  if(!title) throw new ApiError(400,'Notification title is required');
  if(!message) throw new ApiError(400,'Notification message is required');

  const ids=eligible.filter(u=>u.id!==req.user.id).map(u=>u.id);
  const { notifyUsers } = require('../../services/notify.service');
  await notifyUsers(ids, {
    senderUserId: req.user.id,
    type: 'SCHEME_MESSAGE',
    title,
    message,
    actionUrl: '/schemes',
  });

  return success(res,{message:`Scheme notification sent to ${ids.length} residents of ${scheme.ward?.wardNumber||'the publishing ward'}`,data:{recipientCount:ids.length,wardId:targetWardId,ward:scheme.ward}});
});
module.exports={list,markRead,markAllRead,clearAll,send,recipients,sendScheme,schemeRecipients};

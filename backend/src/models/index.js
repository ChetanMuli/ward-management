const sequelize = require('../config/database');

const Role = require('./role.model');
const User = require('./user.model');
const Ward = require('./ward.model');
const Area = require('./area.model');
const House = require('./house.model');
const Family = require('./family.model');
const Person = require('./person.model');
const VoterProfile = require('./voterProfile.model');
const DeathRecord = require('./deathRecord.model');
const Employee = require('./employee.model');
const Complaint = require('./complaint.model');
const ComplaintHistory = require('./complaintHistory.model');
const UpdateRequest = require('./updateRequest.model');
const Notification = require('./notification.model');
const AuditLog = require('./auditLog.model');
const Scheme = require('./scheme.model');
const GovernmentVoterList = require('./governmentVoterList.model');
const WardUpdate = require('./wardUpdate.model');
const WardChatGroup = require('./wardChatGroup.model');
const WardChatGroupMember = require('./wardChatGroupMember.model');
const WardChatMessage = require('./wardChatMessage.model');
const AllChat = require('./allChat.model');
const AllChatMember = require('./allChatMember.model');
const AllChatMessage = require('./allChatMessage.model');
const GroupChat = require('./groupChat.model');
const GroupChatMember = require('./groupChatMember.model');
const GroupChatMessage = require('./groupChatMessage.model');
const ChatUserState = require('./chatUserState.model');
const WardNagarsevakSubscription = require('./wardNagarsevakSubscription.model');
const PersonDocument = require('./personDocument.model');
const PersonBirthday = require('./personBirthday.model');
const DeathObservance = require('./deathObservance.model');
const WardSubscriptionEvent = require('./wardSubscriptionEvent.model');
const EmployeeAreaAssignment = require('./employeeAreaAssignment.model');
const ComplaintAttachment = require('./complaintAttachment.model');
const {
  AdminUser,
  SubAdminUser,
  NagarsevakUser,
  EmployeeUser,
  CitizenUser,
  CommunityUser,
} = require('./roleLogins.model');
const { bindUserHooks } = require('../services/accountStore');
const { registerNormalizedHooks } = require('./hooks');

// ---- Role <-> User ----
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId' });

// ---- User <-> Person (a citizen login is linked to exactly one Person) ----
User.belongsTo(Person, { foreignKey: 'personId', as: 'person' });
Person.hasOne(User, { foreignKey: 'personId', as: 'loginAccount' });

// ---- Ward <-> Area ----
Ward.hasMany(Area, { foreignKey: 'wardId', as: 'areas' });
Ward.hasMany(User, { foreignKey: 'wardId', as: 'users' });
User.belongsTo(Ward, { foreignKey: 'wardId', as: 'ward' });
Area.belongsTo(Ward, { foreignKey: 'wardId', as: 'ward' });

// ---- Area <-> House ----
Area.hasMany(House, { foreignKey: 'areaId', as: 'houses' });
House.belongsTo(Area, { foreignKey: 'areaId', as: 'area' });

// ---- House <-> Family ----
House.hasMany(Family, { foreignKey: 'houseId', as: 'families' });
Family.belongsTo(House, { foreignKey: 'houseId', as: 'house' });

// ---- Family <-> Person ----
Family.hasMany(Person, { foreignKey: 'familyId', as: 'members' });
Person.belongsTo(Family, { foreignKey: 'familyId', as: 'family' });

// ---- Person <-> VoterProfile (1:1) ----
Person.hasOne(VoterProfile, { foreignKey: 'personId', as: 'voterProfile' });
VoterProfile.belongsTo(Person, { foreignKey: 'personId' });

// ---- Person <-> DeathRecord (1:1) ----
Person.hasOne(DeathRecord, { foreignKey: 'personId', as: 'deathRecord' });
DeathRecord.belongsTo(Person, { foreignKey: 'personId' });
Person.hasOne(DeathObservance, { foreignKey: 'personId', as: 'deathObservance' });
DeathObservance.belongsTo(Person, { foreignKey: 'personId', as: 'person' });
DeathRecord.hasOne(DeathObservance, { foreignKey: 'deathRecordId', as: 'observance' });
DeathObservance.belongsTo(DeathRecord, { foreignKey: 'deathRecordId', as: 'deathRecord' });
DeathObservance.belongsTo(Ward, { foreignKey: 'wardId', as: 'ward' });
DeathObservance.belongsTo(House, { foreignKey: 'houseId', as: 'house' });
DeathObservance.belongsTo(Family, { foreignKey: 'familyId', as: 'family' });

Person.hasMany(PersonDocument, { foreignKey: 'personId', as: 'documents' });
PersonDocument.belongsTo(Person, { foreignKey: 'personId', as: 'person' });
Person.hasOne(PersonBirthday, { foreignKey: 'personId', as: 'birthday' });
PersonBirthday.belongsTo(Person, { foreignKey: 'personId', as: 'person' });
PersonBirthday.belongsTo(Ward, { foreignKey: 'wardId', as: 'ward' });
PersonBirthday.belongsTo(House, { foreignKey: 'houseId', as: 'house' });
PersonBirthday.belongsTo(Family, { foreignKey: 'familyId', as: 'family' });

// ---- Employee <-> User (1:1) ----
User.hasOne(Employee, { foreignKey: 'userId', as: 'employeeProfile' });
Ward.hasMany(Employee, { foreignKey: 'wardId', as: 'employees' });
Employee.belongsTo(Ward, { foreignKey: 'wardId', as: 'ward' });
Employee.belongsTo(User, { foreignKey: 'userId' });
Employee.belongsTo(User, { foreignKey: 'managerUserId', as: 'manager' });
User.hasMany(Employee, { foreignKey: 'managerUserId', as: 'managedEmployees' });
Employee.hasMany(EmployeeAreaAssignment, { foreignKey: 'employeeId', as: 'areaAssignments' });
EmployeeAreaAssignment.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });
EmployeeAreaAssignment.belongsTo(Area, { foreignKey: 'areaId', as: 'area' });
Area.hasMany(EmployeeAreaAssignment, { foreignKey: 'areaId', as: 'employeeAssignments' });

// ---- House <-> Employee (assigned employee) ----
Employee.hasMany(House, { foreignKey: 'assignedEmployeeId', as: 'assignedHouses' });
House.belongsTo(Employee, { foreignKey: 'assignedEmployeeId', as: 'assignedEmployee' });

// ---- Complaint relationships ----
Person.hasMany(Complaint, { foreignKey: 'citizenPersonId', as: 'complaints' });
Complaint.belongsTo(Person, { foreignKey: 'citizenPersonId', as: 'citizen' });
User.hasMany(Complaint, { foreignKey: 'submittedByUserId', as: 'submittedComplaints' });
Complaint.belongsTo(User, { foreignKey: 'submittedByUserId', as: 'submittedBy' });
Ward.hasMany(Complaint, { foreignKey: 'wardId', as: 'wardComplaints' });
Complaint.belongsTo(Ward, { foreignKey: 'wardId', as: 'ward' });
Complaint.belongsTo(User, { foreignKey: 'assignedNagarsevakUserId', as: 'assignedNagarsevak' });

House.hasMany(Complaint, { foreignKey: 'houseId', as: 'complaints' });
Complaint.belongsTo(House, { foreignKey: 'houseId', as: 'house' });

Employee.hasMany(Complaint, { foreignKey: 'assignedEmployeeId', as: 'assignedComplaints' });
Complaint.belongsTo(Employee, { foreignKey: 'assignedEmployeeId', as: 'assignedEmployee' });

Complaint.hasMany(ComplaintHistory, { foreignKey: 'complaintId', as: 'history' });
ComplaintHistory.belongsTo(Complaint, { foreignKey: 'complaintId' });
Complaint.hasMany(ComplaintAttachment, { foreignKey: 'complaintId', as: 'attachments' });
ComplaintAttachment.belongsTo(Complaint, { foreignKey: 'complaintId', as: 'complaint' });

User.hasMany(ComplaintHistory, { foreignKey: 'changedByUserId' });
ComplaintHistory.belongsTo(User, { foreignKey: 'changedByUserId', as: 'changedBy' });

// ---- UpdateRequest ----
Person.hasMany(UpdateRequest, { foreignKey: 'personId', as: 'updateRequests' });
UpdateRequest.belongsTo(Person, { foreignKey: 'personId' });

User.hasMany(UpdateRequest, { foreignKey: 'requestedByUserId' });
UpdateRequest.belongsTo(User, { foreignKey: 'requestedByUserId', as: 'requestedBy' });

// ---- Notification ----
User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'recipient' });
User.hasMany(Notification, { foreignKey: 'senderUserId', as: 'sentNotifications' });
Notification.belongsTo(User, { foreignKey: 'senderUserId', as: 'sender' });

// ---- AuditLog ----
User.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });

// ---- Death records ----
User.hasMany(DeathRecord, { foreignKey: 'reportedBy', as: 'reportedDeaths' });
DeathRecord.belongsTo(User, { foreignKey: 'reportedBy', as: 'reporter' });

// ---- Government voter lists (independent source) ----
User.hasMany(GovernmentVoterList, { foreignKey: 'uploadedBy', as: 'uploadedGovernmentVoterLists' });
GovernmentVoterList.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });

// ---- Ward updates / events ----
Ward.hasMany(WardUpdate, { foreignKey: 'wardId', as: 'updates' });
WardUpdate.belongsTo(Ward, { foreignKey: 'wardId', as: 'ward' });
User.hasMany(WardUpdate, { foreignKey: 'createdByUserId', as: 'createdWardUpdates' });
WardUpdate.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });

// ---- Schemes ----
Ward.hasMany(Scheme, { foreignKey: 'wardId', as: 'schemes' });
Scheme.belongsTo(Ward, { foreignKey: 'wardId', as: 'ward' });
User.hasMany(Scheme, { foreignKey: 'createdByUserId', as: 'createdSchemes' });
Scheme.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });


// ---- Legacy combined ward chat (kept for rollback / unread copies) ----
Ward.hasMany(WardChatGroup, { foreignKey:'wardId', as:'chatGroups' });
WardChatGroup.belongsTo(Ward, { foreignKey:'wardId', as:'ward' });
User.hasMany(WardChatGroup, { foreignKey:'nagarsevakUserId', as:'nagarsevakGroupsLegacy' });
WardChatGroup.belongsTo(User, { foreignKey:'nagarsevakUserId', as:'nagarsevak' });
User.hasMany(WardChatGroup, { foreignKey:'createdByUserId', as:'createdChatGroupsLegacy' });
WardChatGroup.belongsTo(User, { foreignKey:'createdByUserId', as:'createdBy' });
WardChatGroup.hasMany(WardChatGroupMember, { foreignKey:'groupId', as:'members' });
WardChatGroupMember.belongsTo(WardChatGroup, { foreignKey:'groupId', as:'group' });
User.hasMany(WardChatGroupMember, { foreignKey:'userId', as:'chatMembershipsLegacy' });
WardChatGroupMember.belongsTo(User, { foreignKey:'userId', as:'user' });
WardChatGroup.hasMany(WardChatMessage, { foreignKey:'groupId', as:'messages' });
WardChatMessage.belongsTo(WardChatGroup, { foreignKey:'groupId', as:'group' });
User.hasMany(WardChatMessage, { foreignKey:'senderUserId', as:'chatMessagesLegacy' });
WardChatMessage.belongsTo(User, { foreignKey:'senderUserId', as:'sender' });

// ---- All chat (ward community) ----
Ward.hasMany(AllChat, { foreignKey:'wardId', as:'allChats' });
AllChat.belongsTo(Ward, { foreignKey:'wardId', as:'ward' });
User.hasMany(AllChat, { foreignKey:'createdByUserId', as:'createdAllChats' });
AllChat.belongsTo(User, { foreignKey:'createdByUserId', as:'createdBy' });
AllChat.hasMany(AllChatMember, { foreignKey:'groupId', as:'members' });
AllChatMember.belongsTo(AllChat, { foreignKey:'groupId', as:'group' });
User.hasMany(AllChatMember, { foreignKey:'userId', as:'allChatMemberships' });
AllChatMember.belongsTo(User, { foreignKey:'userId', as:'user' });
AllChat.hasMany(AllChatMessage, { foreignKey:'groupId', as:'messages' });
AllChatMessage.belongsTo(AllChat, { foreignKey:'groupId', as:'group' });
User.hasMany(AllChatMessage, { foreignKey:'senderUserId', as:'allChatMessages' });
AllChatMessage.belongsTo(User, { foreignKey:'senderUserId', as:'sender' });

// ---- Group chat (Nagarsevak + custom) ----
Ward.hasMany(GroupChat, { foreignKey:'wardId', as:'groupChats' });
GroupChat.belongsTo(Ward, { foreignKey:'wardId', as:'ward' });
User.hasMany(GroupChat, { foreignKey:'nagarsevakUserId', as:'nagarsevakGroups' });
GroupChat.belongsTo(User, { foreignKey:'nagarsevakUserId', as:'nagarsevak' });
User.hasMany(GroupChat, { foreignKey:'createdByUserId', as:'createdChatGroups' });
GroupChat.belongsTo(User, { foreignKey:'createdByUserId', as:'createdBy' });
GroupChat.hasMany(GroupChatMember, { foreignKey:'groupId', as:'members' });
GroupChatMember.belongsTo(GroupChat, { foreignKey:'groupId', as:'group' });
User.hasMany(GroupChatMember, { foreignKey:'userId', as:'groupChatMemberships' });
GroupChatMember.belongsTo(User, { foreignKey:'userId', as:'user' });
GroupChat.hasMany(GroupChatMessage, { foreignKey:'groupId', as:'messages' });
GroupChatMessage.belongsTo(GroupChat, { foreignKey:'groupId', as:'group' });
User.hasMany(GroupChatMessage, { foreignKey:'senderUserId', as:'groupChatMessages' });
GroupChatMessage.belongsTo(User, { foreignKey:'senderUserId', as:'sender' });

Ward.hasMany(WardNagarsevakSubscription, { foreignKey: 'wardId', as: 'nagarsevakSubscriptions' });
WardNagarsevakSubscription.belongsTo(Ward, { foreignKey: 'wardId', as: 'ward' });
User.hasMany(WardNagarsevakSubscription, { foreignKey: 'nagarsevakUserId', as: 'nagarsevakSubscriptions' });
WardNagarsevakSubscription.belongsTo(User, { foreignKey: 'nagarsevakUserId', as: 'nagarsevak' });
WardNagarsevakSubscription.hasMany(WardSubscriptionEvent, { foreignKey: 'subscriptionId', as: 'events' });
WardSubscriptionEvent.belongsTo(WardNagarsevakSubscription, { foreignKey: 'subscriptionId', as: 'subscription' });
WardSubscriptionEvent.belongsTo(Ward, { foreignKey: 'wardId', as: 'ward' });
WardSubscriptionEvent.belongsTo(User, { foreignKey: 'nagarsevakUserId', as: 'nagarsevak' });
WardSubscriptionEvent.belongsTo(User, { foreignKey: 'actedBy', as: 'actor' });

User.hasOne(AdminUser, { foreignKey: 'id', as: 'adminAccount' });
AdminUser.belongsTo(User, { foreignKey: 'id', as: 'user' });
User.hasOne(SubAdminUser, { foreignKey: 'id', as: 'subAdminAccount' });
SubAdminUser.belongsTo(User, { foreignKey: 'id', as: 'user' });
User.hasOne(NagarsevakUser, { foreignKey: 'id', as: 'nagarsevakAccount' });
NagarsevakUser.belongsTo(User, { foreignKey: 'id', as: 'user' });
User.hasOne(EmployeeUser, { foreignKey: 'id', as: 'employeeAccount' });
EmployeeUser.belongsTo(User, { foreignKey: 'id', as: 'user' });
User.hasOne(CitizenUser, { foreignKey: 'id', as: 'citizenAccount' });
CitizenUser.belongsTo(User, { foreignKey: 'id', as: 'user' });
User.hasOne(CommunityUser, { foreignKey: 'id', as: 'communityAccount' });
CommunityUser.belongsTo(User, { foreignKey: 'id', as: 'user' });

bindUserHooks(User, Role);
registerNormalizedHooks({
  Person,
  PersonDocument,
  Employee,
  EmployeeAreaAssignment,
  Complaint,
  ComplaintAttachment,
  Family,
  House,
  DeathRecord,
});

module.exports = {
  sequelize,
  Role,
  User,
  AdminUser,
  SubAdminUser,
  NagarsevakUser,
  EmployeeUser,
  CitizenUser,
  CommunityUser,
  Ward,
  Area,
  House,
  Family,
  Person,
  VoterProfile,
  DeathRecord,
  Employee,
  Complaint,
  ComplaintHistory,
  UpdateRequest,
  Notification,
  AuditLog,
  Scheme,
  GovernmentVoterList,
  WardUpdate,
  WardChatGroup,
  WardChatGroupMember,
  WardChatMessage,
  AllChat,
  AllChatMember,
  AllChatMessage,
  GroupChat,
  GroupChatMember,
  GroupChatMessage,
  ChatUserState,
  WardNagarsevakSubscription,
  PersonDocument,
  PersonBirthday,
  DeathObservance,
  WardSubscriptionEvent,
  EmployeeAreaAssignment,
  ComplaintAttachment,
};

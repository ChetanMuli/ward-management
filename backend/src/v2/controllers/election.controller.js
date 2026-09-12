const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');

const SIR_URL='https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/08/17864304818676.pdf';
const SIR_DISTRICT_URL='https://ahilyanagar.maharashtra.gov.in/en/district-election-office-ahmednagar/';
const AMC_ELECTION_URL='https://amc.gov.in/en/election/';
const rows=[
{"ward":"W-01","count":22088,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_1.pdf"},
{"ward":"W-02","count":21513,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_2.pdf"},
{"ward":"W-03","count":14527,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_3.pdf"},
{"ward":"W-04","count":19256,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_4.pdf"},
{"ward":"W-05","count":14950,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_5.pdf"},
{"ward":"W-06","count":17150,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_6.pdf"},
{"ward":"W-07","count":15833,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_7.pdf"},
{"ward":"W-08","count":18020,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_8.pdf"},
{"ward":"W-09","count":17159,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_9.pdf"},
{"ward":"W-10","count":22900,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_10.pdf"},
{"ward":"W-11","count":20670,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_11.pdf"},
{"ward":"W-12","count":19382,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_12.pdf"},
{"ward":"W-13","count":15723,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_13.pdf"},
{"ward":"W-14","count":17020,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_14.pdf"},
{"ward":"W-15","count":16656,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_15.pdf"},
{"ward":"W-16","count":18874,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_16.pdf"},
{"ward":"W-17","count":15288,"url":"https://amc.gov.in/wp-content/uploads/2025/12/FinalList_Ward_17.pdf"}
];

const list=asyncHandler(async(req,res)=>{
  let visible=rows;
  if(req.user.roleName==='NAGARSEVAK'){
    const own=String(req.user.ward?.wardNumber||req.user.wardNumber||'').replace(/^W-?/i,'').padStart(2,'0');
    if(!own) throw new ApiError(403,'Your Nagarsevak account is not assigned to a ward.');
    visible=rows.filter(r=>r.ward.replace(/^W-?/i,'')===own);
  } else if(req.user.roleName==='EMPLOYEE'){
    const own=String(req.user.ward?.wardNumber||req.user.wardNumber||'').replace(/^W-?/i,'').padStart(2,'0');
    if(own) visible=rows.filter(r=>r.ward.replace(/^W-?/i,'')===own);
  }
  return success(res,{data:{rows:visible,sirUrl:SIR_URL,sirDistrictUrl:SIR_DISTRICT_URL,amcElectionUrl:AMC_ELECTION_URL}});
});
module.exports={list};

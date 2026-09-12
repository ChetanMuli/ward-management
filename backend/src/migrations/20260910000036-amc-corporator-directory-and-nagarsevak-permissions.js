'use strict';

const { QueryTypes } = require('sequelize');
const { ALL_PERMISSIONS } = require('../v2/utils/permissions');

const AMC_SOURCE = 'https://amc.gov.in/en/corporates/';

/**
 * Syncs the current AMC 2025-26 corporator directory fields already represented
 * by WardDesk and enables granular permissions for Nagarsevak accounts.
 *
 * Source: Ahilyanagar Municipal Corporation — Our Corporators.
 * The AMC directory publishes ward/seat, name, address, party and mobile.
 */
const CORPORATORS = [
    ["W-01", "1-A", "Borude Sagar Arjun", "9822115406", "Nationalist Congress Party", "Bhairavnath Hospital, Nagapur, Ahilyanagar"],
    ["W-01", "1-B", "Dhawan Sharda Digambar", "9699224701", "Bharatiya Janata Party", "Dhavanvasti, Tapovan Road, Ahilyanagar - 414 003"],
    ["W-01", "1-C", "Barskar Deepali Nitin", "9822415757", "Nationalist Congress Party", "G.No.1, Jakat Naka, Savedi-Manmad Road, Ahilyanagar"],
    ["W-01", "1-D", "Barskar Sampat Vijay", "9890408050", "Nationalist Congress Party", "Savedi, Taluka. Dist. Ahilyanagar"],
    ["W-02", "2-A", "Roshni Akash Trimbake", "9552690159", "Bharatiya Janata Party", "Dhorgali, Behind Balikashram, Delhi Gate, Ahilyanagar - 414 001"],
    ["W-02", "2-B", "Tawale Mahesh Raghunath", "9260029999", "Nationalist Congress Party", "Plot No. 68, Ahilyanagar-Sambhajinagar Road, Tawalenagar, Savedi, Ahilyanagar"],
    ["W-02", "2-C", "Pawar Sandhya Balasaheb", "9561252700", "Nationalist Congress Party", "Baijabai Society, Pipeline Road, Savedi, Ahilyanagar - 414 003"],
    ["W-02", "2-D", "Nikhil Babasaheb Ware", "9850000852", "Bharatiya Janata Party", "Bahar Urban Bank Colony, Shila Vihar, Savedi, Ahilyanagar"],
    ["W-03", "3-A", "Gade Yogiraj (Appa) Shashikant", "9689896982", "Shiv Sena (Uddhav Balasaheb Thackeray)", "Yashanjali, Yashwantnagar, Near Maruti Mandir, Govindpura, Ahilyanagar - 414 003"],
    ["W-03", "3-B", "Gade Jyoti Amol", "8975872525", "Nationalist Congress Party", "Yashwantnagar, Near Hanuman Temple, Govindpura, Ahilyanagar - 414 003"],
    ["W-03", "3-C", "Borkar Gauri Ajinkya", "9225522255", "Nationalist Congress Party", "Plot No. 25, Pasaidan, Pankaj Colony, Near T.V. Center, Savedi, Ahilyanagar - 414 003"],
    ["W-03", "3-D", "Adv. Rugved Mahendra (Bhiyya) Gandhe", "9421999494", "Bharatiya Janata Party", "270/32, Manisha, Suyog Housing Society, Professor Colony, Savedi Road, Ahilyanagar"],
    ["W-04", "4-A", "Sheikh Shehnaz Khalid", "9730007861", "All India Majlis Ittehdul Muslimeen (AIMIM)", "Gh.No.8, Mulla Colony, Near Inam Masjid, Mukundnagar, Ahilyanagar - 414 001"],
    ["W-04", "4-B", "Sayyed Shahbaz Ahmed", "8408088888", "All India Majlis Ittehdul Muslimeen (AIMIM)", "Plot No. 96/A, CIV Housing Soc., Darga Dayera Road, Mukundnagar, Ahilyanagar - 414 001"],
    ["W-04", "4-C", "Khan Minaj Jafar", "9021112312", "Indian National Congress", "R.G. No. 24/25, Mulla Colony, Mukundnagar, Ahilyanagar - 414 001"],
    ["W-04", "4-D", "Khan Shams Samiullah", "7020792703", "Indian National Congress", "Bungalow No. 7, Sheetal Colony, Near Ayesha Masjid, Mukundnagar, Ahilyanagar - 414 001"],
    ["W-05", "5-A", "Bhosale Kajal Gorakh", "9011761958", "Nationalist Congress Party", "Bharaskar Colony, Laltaki, Ahilyanagar, Halli Mukkam Bolhegaon, Ahilyanagar"],
    ["W-05", "5-B", "Jadhav Dhananjaya Krishna", "9111763755", "Bharatiya Janata Party", "6840, Near Maruti Temple, Topkhana, Ahilyanagar"],
    ["W-05", "5-C", "Gambhir HarpreetKaur Jagjit Singh", "9162720707", "Nationalist Congress Party", "Gh.No. 9, Sindhi Colony, Tarakpur, Ahilyanagar - 414 001"],
    ["W-05", "5-D", "Punjabi Mohit Pradeep", "9766118118", "Nationalist Congress Party", "Ramkunj, Yashwant Colony, Sambhajinagar Road, Ahilyanagar - 414 001"],
    ["W-06", "6-A", "Dulam Manoj Laxman", "9225700007", "Bharatiya Janata Party", "73/D, Near Balaji Temple, Shramik Nagar, Savedi, Ahilyanagar - 414 003"],
    ["W-06", "6-B", "Shinde Sonabai Taiga", "9922573303", "Bharatiya Janata Party", "Shindenagar, Vaiduwadi, Savedi, Ahilyanagar"],
    ["W-06", "6-C", "Kulkarni Sunita Shrikrishna", "8830159083", "Bharatiya Janata Party", "2070, Ajay Apartment, Near Labour Court, Savedi, Ahilyanagar"],
    ["W-06", "6-D", "Karan Uday Karale", "8788536401", "Bharatiya Janata Party", "Near Talathi Office, Savedi Village, Ahilyanagar"],
    ["W-07", "7-A", "Varsha Rohan Sanap", "8421383333", "Bharatiya Janata Party", "24, Shivkripa, Ajinkyanagar, Bhutkarwadi, Ahilyanagar"],
    ["W-07", "7-B", "Borude Pushpa Anil", "9422227473", "Bharatiya Janata Party", "Rakhmai Niwas, Borude Mala, Balikashram Road, Ahilyanagar"],
    ["W-07", "7-C", "Tathe Vandana Vilas", "7028639999", "Bharatiya Janata Party", "Plot No. 1/11, Mahalaxmi Niwas, Pumping Station Road, Tathe Mala, Savedi, Ahilyanagar - 414 003"],
    ["W-07", "7-D", "Wakale Babasaheb Sonyabapu", "9422226510", "Bharatiya Janata Party", "Near Tukaram Maharaj Temple, Savedi Village, Savedi, Ahilyanagar"],
    ["W-08", "8-A", "Bhingardive Sunita Kisan", "9822463388", "Nationalist Congress Party", "Bhingardive Mall, Gandhinagar, Bolhegaon, Taluka. Dist. Ahilyanagar - 414 111"],
    ["W-08", "8-B", "Katore Ashabai Lobhaji", "9764656666", "Bharatiya Janata Party", "Katore Wasti, Bolhegaon Phata, Nagapur, Bolhegaon, Ahilyanagar"],
    ["W-08", "8-C", "Katore Navnath Machhindra", "8208859009", "Shiv Sena", "Katore Wasti, MIDC Nagapur, Ahilyanagar"],
    ["W-08", "8-D", "Wakale Kumar Babanrao", "9730015555", "Nationalist Congress Party", "Sangharsh Chowk, Savedi, Ahilyanagar - 414 003"],
    ["W-09", "9-A", "Shendge Sanjay Chaganrao", "9822788388", "Shiv Sena", "13, Near Satalkar Hospital, Renavikar Colony, Ahilyanagar"],
    ["W-09", "9-B", "Datrange Rupali Sandeep", "9763161001", "Shiv Sena", "Datrange Mala, Ahilyanagar"],
    ["W-09", "9-C", "Vaishali Sham (Appa) Nalkande", "9850184263", "Shiv Sena", "S.No. 235, 2B/2, Ketan Park, Shivajinagar, Nagar-Kalyan Road, Ahilyanagar"],
    ["W-09", "9-D", "Londhe Mahesh Ram", "8657161616", "Bharatiya Janata Party", "Plot No. 11, Londhemala, Nagar-Kalyan Road, Sambhajinagar, Ahilyanagar"],
    ["W-10", "10-A", "Chindam Shripad Shankar", "9370422222", "Bahujan Samaj Party", "Mohan Bagh Delhi Gate, Ahilyanagar"],
    ["W-10", "10-B", "Dhone Sheetal Ajay (Vahini)", "9422220548", "Bharatiya Janata Party", "D.No.6915, Lonar Galli, Sarjepura, Ahilyanagar"],
    ["W-10", "10-C", "Jadhav Mayuri Sushant", "7020991165", "Bharatiya Janata Party", "G.No. 779/80, Thakur Wada, Near Surana Apartment, Topkhana, Ahilyanagar"],
    ["W-10", "10-D", "Sagar Raju Murtudkar", "8055548547", "Bharatiya Janata Party", "Gh.No. 2231, Near Mahadev Temple, Vanjar Galli, Ahilyanagar"],
    ["W-11", "11-A", "Kavade Umesh (Ganesh) Khanderao", "8830303434", "Shiv Sena", "Kavade Galli, Nalegaon, Ahilyanagar"],
    ["W-11", "11-B", "Genappa Sunita Santosh", "9420689999", "Shiv Sena", "Amey Apartment, Court Galli, Ahilyanagar"],
    ["W-11", "11-C", "Dagwale Asha Kishore", "9028969009", "Nationalist Congress Party", "4259, Dagwale Building, Patwardhan Chowk, Anandi Bazar, Ahilyanagar"],
    ["W-11", "11-D", "Londhe Subhash Sopanrao", "9921799992", "Bharatiya Janata Party", "7556, Lakshmi Nivas, Near Hanuman Temple, Zarekar Galli, Nalegaon, Ahilyanagar"],
    ["W-12", "12-A", "Lokhande Mangal Sunil", "9423561112", "Shiv Sena", "Aman Patil Road, Near Kauthi Chi Talim, Maliwada, Ahilyanagar"],
    ["W-12", "12-B", "Surekha Sambhaji Kadam", "9422222003", "Shiv Sena", "Shaan Building, Varwande Galli, Maliwada, Ahilyanagar"],
    ["W-12", "12-C", "Balasaheb Maruti Borate", "9422222079", "Shiv Sena", "5117/18, Maruti Rabhaji Memorial, Brahmin Galli, Maliwada, Ahilyanagar"],
    ["W-12", "12-D", "Kaware Dattatraya Haribhau", "9881777760", "Shiv Sena", "G.No. 5067, Bhist Galli, Maliwada, Ahilyanagar"],
    ["W-13", "13-A", "Suresh Laxman Bansode", "9499992222", "Nationalist Congress Party", "Behind Raghavendra Swami Temple, Nikhil Rd. Housing, Bolhegaon, Tal. Dist. Ahilyanagar - 414 111"],
    ["W-13", "13-B", "Padole Sujata Mahendra", "9850211111", "Nationalist Congress Party", "Padole Chawl, Tilak Road, Ahilyanagar"],
    ["W-13", "13-C", "Shetia Anita Vipul", "9822069811", "Nationalist Congress Party", "MSEB Colony, Burudgaon Road, Ahilyanagar - 414 001"],
    ["W-13", "13-D", "Ghule Avinash (Tatya) Haribhau", "9765161616", "Nationalist Congress Party", "4799, Maliwada, Par Gali, Ganapati Mandir Road, Ahilyanagar - 414 001"],
    ["W-14", "14-A", "Bhaganagare Prakash Baburao", "9422230181", "Nationalist Congress Party", "Anandnagar, Station Road, Near Lokhandi Bridge, Ahilyanagar"],
    ["W-14", "14-B", "Fhulsounder Sunita Bhagwan", "9422222236", "Nationalist Congress Party", "Janaki Niwas, Burudgaon Road, Fhulsaunder Mala, Burudgaon Road, Ahilyanagar"],
    ["W-14", "14-C", "Chopada Meena Sanjay", "9822025757", "Nationalist Congress Party", "Maniknagar, Burudgaon Road, Bhosale Akhada, Ahilyanagar - 414 001"],
    ["W-14", "14-D", "Ganesh Pundalik Bhosale", "9922951596", "Nationalist Congress Party", "Gurukunj Niwas, Sainagar, Burudgaon Road, Ahilyanagar - 414 001"],
    ["W-15", "15-A", "Gavhale Pornima Vijaya", "9822991496", "Nationalist Congress Party", "Bohri Chawl, Shivneri Marg, Shamsher Baba Dargah, Taluka. Dist. Ahilyanagar"],
    ["W-15", "15-B", "Datta Somnath Gadalkar", "9225541111", "Bharatiya Janata Party", "Nagar-Kalyan Road, Suyog Park, Gadalkar Mala, T. Dist. Ahilyanagar"],
    ["W-15", "15-C", "Gitanjali Sunil Kale", "9225700502", "Nationalist Congress Party", "Vatsalya, Agarkar Mala, Station Road, Taluka. Dist. Ahilyanagar"],
    ["W-15", "15-D", "Mohite Sujay Anil", "9816061616", "Bharatiya Janata Party", "Dutt Chowk, Bhushannagar Kedgaon, Tel. Dist. Ahilyanagar"],
    ["W-16", "16-A", "Sunita Mahendra Kamble", "9881984177", "Nationalist Congress Party", "368/1, Nagar-Pune Road, Kamble Wasti, Kedgaon, Ahilyanagar"],
    ["W-16", "16-B", "Varsha Sujit Kakade", "9823047481", "Nationalist Congress Party", "Plot No. 103, Vaishnavi, Nagar-Pune Road, Behind Toyota Showroom, Rajendranagar, Kakade Mala, Kedgaon, Ahilyanagar"],
    ["W-16", "16-C", "Vijay Mohanrao Pathare", "9623240303", "Bharatiya Janata Party", "Dutt Chowk, Bhushannagar, Kedgaon, Ahilyanagar - 414 005"],
    ["W-16", "16-D", "Dnyaneshwar alias Amol Shivaji Yewale", "9881778181", "Bharatiya Janata Party", "Kranti Chowk, Sutargalli, Kedgaon, Ahilyanagar - 414 005"],
    ["W-17", "17-A", "Mayur Kanhaiyalal Bangre", "8888232352", "Nationalist Congress Party", "Station Road, Kinetic Chowk, Adarsh Rohidasnagar, Ahilyanagar"],
    ["W-17", "17-B", "Ashwini Sumit Londhe", "7020346518", "Nationalist Congress Party", "Londhe Mala, Sonewadi Road, Kedgaon, Ahilyanagar"],
    ["W-17", "17-C", "Kamal Jalinder Kotkar", "9850489999", "Bharatiya Janata Party", "Kotkar Mala, Behind Aarti Hotel, Kedgaon, Ahilyanagar - 414 005"],
    ["W-17", "17-D", "Manoj Shankar Kotkar", "9890449126", "Bharatiya Janata Party", "Kotkar Mala, Devi Road, Kedgaon, Ahilyanagar - 414 005"]
];

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const [roles] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name = 'NAGARSEVAK' LIMIT 1`,
        { type: QueryTypes.SELECT, transaction }
      );
      if (!roles) throw new Error('NAGARSEVAK role not found');

      let synced = 0;
      for (const [wardNumber, wardSeat, name, mobile, partyName, officialAddress] of CORPORATORS) {
        const [wards] = await queryInterface.sequelize.query(
          `SELECT id FROM wards WHERE ward_number = :wardNumber LIMIT 1`,
          { replacements: { wardNumber }, type: QueryTypes.SELECT, transaction }
        );
        if (!wards) continue;

        const [user] = await queryInterface.sequelize.query(
          `SELECT id FROM users
           WHERE role_id = :roleId AND mobile = :mobile
           LIMIT 1`,
          {
            replacements: { roleId: roles.id, mobile },
            type: QueryTypes.SELECT,
            transaction
          }
        );
        if (!user) continue;

        await queryInterface.sequelize.query(
          `UPDATE users
           SET ward_id = :wardId,
               ward_seat = :wardSeat,
               party_name = :partyName,
               official_address = :officialAddress,
               permissions = :permissions
           WHERE id = :id`,
          {
            replacements: {
              id: user.id,
              wardId: wards.id,
              wardSeat,
              partyName,
              officialAddress,
              permissions: JSON.stringify(ALL_PERMISSIONS)
            },
            type: QueryTypes.UPDATE,
            transaction
          }
        );
        synced += 1;
      }

      await transaction.commit();
      console.log(`AMC corporator directory sync: ${synced}/${CORPORATORS.length} accounts; Nagarsevak permissions enabled.`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down() {
    // Intentionally non-destructive. Official directory values and permissions
    // are application master data; rollback must not remove accounts.
  }
};

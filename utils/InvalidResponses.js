const inValidResponses = [
  {
    service: "udyam",
    InValidResponse: {
      "Date of Commencement of Production/Business": "",
      "Date of Incorporation": "",
      "Date of Udyam Registration": "",
      "MSME-DFO": "",
      "Major Activity": "",
      "Name of Enterprise": "",
      "Organisation Type": "",
      "Social Category": "",
      "Enterprise Type": [],
      "National Industry Classification Code(S)": [],
      "Official address of Enterprise": {},
    },
  },
  {
    service: "gstIn",
    InValidResponse: {
      business_constitution: "",
      companyName: "",
      other_business_address: "",
      register_cancellation_date: "",
      state_jurisdiction: "",
      tax_payer_type: "",
      trade_name: "",
      primary_business_address: {
        building_name: "",
        building_number: "",
        city: "",
        district: "",
        flat_number: "",
        latitude: "",
        location: "",
        longitude: "",
        business_nature: "",
        pincode: "",
        street: "",
        state_code: "",
        full_address: "",
      },
    },
  },
  {
    service: "panBasic",
    InValidResponse: {
      PAN: "",
      Name: "",
      PAN_Status: "",
      PAN_Holder_Type: "",
    },
  },
  {
    service: "panToAadhaar",
    InValidResponse: {
      code: "",
      message: "",
      result: {
        aadhaar: "",
      },
    },
  },
  {
    service: "aadhaarToPan",
    InValidResponse: {
      code: "",
      message: "",
      result: {
        pan: "",
      },
    },
  },
  {
    service: "panNameMatch",
    InValidResponse: {
      LastUpdate: "",
      STATUS: "",
      StatusDescription: "",
      name_match_score: "",
    },
  },
  {
    service: "panNameDob",
    InValidResponse: {
      "Status of PAN": "",
      "Given Name matches with the ITD Records": "",
      "Given DOB matches with the ITD Records": "",
    },
  },
  {
    service: "panToGst",
    InValidResponse: {
      gstin: "",
      authStatus: "",
      stateCd: "",
    },
  },
  {
    service: "cin",
    InValidResponse: {
      PAN: "",
      Name: "",
      PAN_Status: "",
      PAN_Holder_Type: "",
    },
  },
  {
    service: "fullCard",
    InValidResponse: {
      cardNumber: "",
      is_Verified: "",
      Brand: "",
      Type: "",
      Category: "",
      CountryName: "",
      Issuer: "",
    },
  },
  {
    service: "license",
    InValidResponse: {
      Address: "",
      "Blood group": "",
      CovDetails: [
        {
          "COV Issue Date": "",
          "Vehicle Class": "",
          "Vehicle Type": "",
        },
      ],
      "Date of Birth": "",
      "Driving License Number": "",
      "Father's Name": "",
      Gender: "",
      LicenseDetails: [
        {
          "Issue Date From": "",
          "Issue Date To": "",
          "License Type": "",
        },
        {
          "Issue Date From": "",
          "Issue Date To": "",
          "License Type": "",
        },
        {
          "Issue Date From": "",
          "Issue Date To": "",
          "License Type": "",
        },
        {
          "Issue Date From": "",
          "Issue Date To": "",
          "License Type": "",
        },
      ],
      "Owner's Name": "",
      "RTO (Issued At)": "",
      State: "",
      Status: "",
      imgurl: "",
    },
  },
  {
    service: "voterId",
    InValidResponse: {
      Age: "",
      "Assembly Constituency": "",
      "Assembly Constituency Number": "",
      District: "",
      Email: "",
      Father: "",
      "Father(Regional Language)": "",
      "Fathers Name": "",
      Gender: "",
      "Last of Date": "",
      "N     Name": "",
      "Name (Regional Language)": "",
      "Parliamentary Constituency": "",
      "Parliamentary Constituency lat long": "",
      "Part Name": "",
      "Part No": "",
      "Polling Station": "",
      "Serial No": "",
      State: "",
      "Voter Id": "",
      status: "",
    },
  },
  {
    service: "passport",
    InValidResponse: {
      "Given Name": "",
      Surname: "",
      "Type of Application": "",
      "Application Received on Date": "",
      "Passport no": "",
      "Date of Birth": "",
    },
  },
  {
    service: "panDirector",
    InValidResponse: {
      name: "",
      din: "",
    },
  },
  {
    service: "latLong",
    InValidResponse: {
      "Center Code": "",
      District: "",
      Pincode: "",
      "Population Group": " ",
      "Post Office": "Kora ",
      "Revenue Center": "",
      State: " ",
      Subdistrict: "",
      Tier: " ",
    },
  },
  {
    service: "pinCode",
    InValidResponse: {
      District: "",
      "Post Office": " ",
      State: " ",
      Subdistrict: "",
    },
  },
  {
    service: "panToFather",
    InValidResponse: {
      data: {
        additional_check: [],
        category: "",
        client_id: "",
        dob: "",
        dob_check: false,
        dob_verified: false,
        father_name: "",
        full_name: "",
        less_info: false,
        pan_number: "",
      },
      message: "",
      message_code: "",
      status_code: "",
      success: "",
    },
  },
];

export const findingInValidResponses = (serviceName) => {
  const match = inValidResponses.find((item) => item.service === serviceName);
  return match?.InValidResponse || null;
};

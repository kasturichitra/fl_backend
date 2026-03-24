const inValidResponses = [
  // pan services ---------------------->>

  // pan basic
  {
    service: "panBasic",
    InValidResponse: {
      PAN: "",
      Name: "",
      PAN_Status: "",
      PAN_Holder_Type: "",
    },
  },
  // pan to masked aadhaar
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
  // pan name match
  {
    service: "panNameMatch",
    InValidResponse: {
      LastUpdate: "",
      STATUS: "",
      StatusDescription: "",
      name_match_score: "",
    },
  },
  // pan name dob 
  {
    service: "panNameDob",
    InValidResponse: {
      "Status of PAN": "",
      "Given Name matches with the ITD Records": "",
      "Given DOB matches with the ITD Records": "",
    },
  },
  // pan to gst
  {
    service: "panToGst",
    InValidResponse: {
      gstin: "",
      authStatus: "",
      stateCd: "",
    },
  },
  // pan to father name
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
  // pan director
  {
    service: "panDirector",
    InValidResponse: {
      name: "",
      din: "",
    },
  },
  // business services --------------------------->>>

  // cin search
  {
    service: "cin",
    InValidResponse: {
      PAN: "",
      Name: "",
      PAN_Status: "",
      PAN_Holder_Type: "",
    },
  },
  // udyam
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
  // gst_in
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
  // vehicle services ------------------->>

  // driving license
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
  // government services ---------------------->>

  // voter id
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
  // passport with file no
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
  // location services ----------------------------->>
  
  // lat long geofencing
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
  // pincode geofencing
  {
    service: "pincode",
    InValidResponse: {
      District: "",
      "Post Office": " ",
      State: " ",
      Subdistrict: "",
    },
  },
  {
    service: "pincode",
    InValidResponse: {
      results: [
        {
          plus_code: "",
          street_number: "",
          route: "",
          locality: "",
          administrative_area_level_4: "",
          administrative_area_level_3: "",
          administrative_area_level_2: "",
          administrative_area_level_1: "",
          country: "",
          postal_code: "",
          formatted_address: "",
          place_id: "",
          types: [],
          digipin: "",
        },
        {
          plus_code: "",
          street_number: "",
          route: "",
          locality: "",
          administrative_area_level_4: "",
          administrative_area_level_3: "",
          administrative_area_level_2: "",
          administrative_area_level_1: "",
          country: "",
          postal_code: "",
          formatted_address: "",
          place_id: "",
          types: [],
          digipin: "",
        },
      ],
    },
  },
];

export const findingInValidResponses = (serviceName) => {
  const match = inValidResponses.find((item) => item.service === serviceName);
  return match?.InValidResponse || null;
};

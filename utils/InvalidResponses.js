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
    service: "panNameMatch",
    InValidResponse: {
      code: "",
      message: "",
      result: {
        aadhaar: "",
      },
    },
  },
  {
    service: "panNameDob",
    InValidResponse: {
      code: "",
      message: "",
      result: {
        aadhaar: "",
      },
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
      imgurl: ""
    },
  },
];

export const findingInValidResponses = (serviceName) => {
  const match = inValidResponses.find((item) => item.service === serviceName);
  return match?.InValidResponse || null;
};

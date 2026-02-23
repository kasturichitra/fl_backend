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
    service: "pan",
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
        aadhaar: ""
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
];

export const findingInValidResponses = (serviceName) => {
  const match = inValidResponses.find((item) => item.service === serviceName);
  return match?.InValidResponse || null;
};

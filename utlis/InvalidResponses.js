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
    service: "pan",
    InValidResponse: {
      PAN: "",
      Name: "",
      PAN_Status: "",
      PAN_Holder_Type: "",
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
];

export const findingInValidResponses = (serviceName) => {
  const match = inValidResponses.find((item) => item.service === serviceName);
  return match?.InValidResponse || null;
};

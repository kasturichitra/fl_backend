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
      "status": 1,
      "msg": {
        "cin": "",
        "company_name": "",
        "roc_code": "",
        "company_status": "",
        "last_update": "",
        "registration_no": "",
        "company_category": "",
        "company_sub_category": "",
        "class_of_company": "",
        "authorised_capital": "",
        "paid_up_capital": "",
        "date_of_incorporation": "",
        "registered_address": "",
        "email_id": "",
        "whether_listed_or_not": "",
        "date_of_last_agm": "",
        "date_of_balance_sheet": "",
        "address_line1": null,
        "address_line2": null,
        "address_state": "",
        "address_city": "",
        "address_country": null,
        "address_pincode": "",
        "assets_under_charge": "",
        "charge_amount": "",
        "date_of_creation": "",
        "date_of_modification": "",
        "status": "",
        "Director": [
          {
            "din": "",
            "name": "",
            "begin_date": "",
            "end_date": ""
          },
          {
            "din": "",
            "name": "",
            "begin_date": "",
            "end_date": ""
          }
        ]
      }
    },
  },
  // CIN TO COMPANYS
  {
    service: 'cinCompanys',
    InValidResponse: [
      {
        "label": "",
        "value": ""
      },
      {
        "label": "",
        "value": ""
      },
    ]
  },
  // COMPANY SEARCH BY NAME ( CIN )
  {
    service: 'CompanySearch',
    InValidResponse: {
      "cin": "",
      "company_name": ""
    }
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
  // GstinToPan
  {
    service: 'GstinToPan',
    InValidResponse: {
      "S.No": "",
      "GST/UIN": "",
      "GSTIN/UIN Status": "",
      "State": "",
      "GSTIN/ UIN": "",
      "Legal Name of Business": "",
      "Centre Jurisdiction": "",
      "State Jurisdiction": "",
      "Date of registration": "",
      "Constitution of Business": "",
      "Taxpayer Type": "",
      "GSTIN / UIN Status": "",
      "Date of Cancellation": "",
      "NatureOfBusinessActivities": "",
      "proprietor_name": "",
      "field_visit_conducted": "",
      "company_name": "",
      "division": "",
      "segment": "",
      "sub_segment": "",
      "placeOfBusinessData": [
        {
          "type": "",
          "nature_of_business_activities": "",
          "address": "",
          "contact_details": ""
        },
        {
          "type": "",
          "nature_of_business_activities": "",
          "address": "",
          "contact_details": ""
        },
        {
          "type": "",
          "nature_of_business_activities": "",
          "address": "",
          "contact_details": ""
        }
      ]
    }
  },
  // Gstingtaxpayer
  {
    service: 'GstinTaxPayer',
    InvalidResponse: {
      "gstin": "",
      "legal_name_of_business": "",
      "centre_jurisdiction": "",
      "state_jurisdiction": "",
      "date_of_registration": "",
      "constitution_of_business": "",
      "taxpayer_type": "",
      "gstin_status": "",
      "date_of_cancellation": "",
      "last_updated_date": "",
      "state_jurisdiction_code": "",
      "centre_jurisdiction_code": "",
      "trade_name": "",
      "address": [
        {
          "building_name": "",
          "street": "",
          "location": "",
          "door_number": "",
          "state_name": "",
          "floor_number": "",
          "lattitude": "",
          "longitude": "",
          "pin_code": ""
        }
      ],
      "nature_of_pricipal_place_of_business": "",
      "Principal Place of Business Address": ""
    }
  },
  //aadhaartopan
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
  // fullcard
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
  // Din
  {
    service: 'Din',
    InValidResponse: {
      "status": 1,
      "msg": {
        "din": "",
        "name": "",
        "company_name": "",
        "company_address": null,
        "cin": "",
        "email": "",
        "date_of_incorporation": "",
        "roc_code": "",
        "director_status": "",
        "last_updated": ""
      }
    }
  },
  //Tin
  {
    service: 'Tin',
    InvalidResponse: {
      "TIN": "",
      "CST Number": "",
      "Dealer Name": "",
      "Dealer Address": "",
      "Date of Registration under CST Act": "",
      "State Name": "",
      "PAN": "",
      "Dealer Registration Status under CST Act": "",
      "This record is valid as on": ""
    }
  },
  // IEC 
  {
    service: 'Iec',
    InvalidResponse: {
      "IEC detail": {
        "IE Code": "",
        "Name": "",
        "Address": "",
        "IEC Status": "",
        "Assessee Code": "",
        "IEC Cancelled date": "",
        "File Number": "",
        "Nature of concern/Firm": "",
        "IEC Suspended date": "",
        "File Date": "",
        "Category of Exporters": "",
        "Date of Birth / Incorporation": "",
        "DEL Status": "",
        "DGFT RA Office": "",
        "IEC issuance date": ""
      },
      "Branch detail": {
        "1": {
          "Branch Code": "",
          "GSTIN": "",
          "Address": ""
        },
        "2": {
          "Branch Code": "",
          "GSTIN": "",
          "Address": ""
        }
      },
      "Proprietor detail": {
        "1": {
          "name": "",
          "pan": ""
        },
        "2": {
          "name": "",
          "pan": ""
        }
      },
      "RCMC Detail": {
        "1": {
          "RCMC Number": "",
          "Issue Date": "",
          "Issue Authority": "",
          "Expiry Date": "",
          "Status": "",
          "Exporter Type": "",
          "Status From EPC": ""
        },
        "12": {
          "RCMC Number": "",
          "Issue Date": "",
          "Issue Authority": "",
          "Expiry Date": "",
          "Status": "",
          "Exporter Type": "",
          "Status From EPC": ""
        }
      }
    }
  },
  // DFGT
  {
    service: 'DFGT',
    InvalidResponse: {
      "branch_details": [
        {
          "s_no": "",
          "branch_gstin": "",
          "branch_address": ""
        }
      ],
      "director_details ": [
        {
          "s_no": "",
          "director_name": "",
          "pan_no": ""
        },
        {
          "s_no": "",
          "director_name": "",
          "pan_no": ""
        }
      ],
      "iec_details": {
        "address": "",
        "category_of_exporters": "",
        "del_status": "",
        "dgft_ra_office": "",
        "dob_incorporation": "",
        "file_date": "",
        "file_number": "",
        "firm_name": "",
        "iec_cancelled_date": "",
        "iec_issuance_date": "",
        "iec_number": "",
        "iec_status": "",
        "iec_suspended_date": "",
        "nature_of_concern": "",
        "pan_number": ""
      }
    }
  },
  // LEI
  {
    service: 'LEI',
    InvalidResponse: {
      "leiDetails": {
        "lei_code": {
          "lei": "",
          "legal_name": "",
          "registered_at": "",
          "registered_as": "",
          "jurisdiction_of_formation": "",
          "general_category": "",
          "entity_legal_form": "",
          "entity_status": "",
          "BIC_code": null
        },
        "addresses": {
          "legal_address": {
            "address_lines": [],
            "postal_code": "",
            "city": "",
            "region": "",
            "country": ""
          },
          "headquarters_address": {
            "address_lines": [],
            "postal_code": "",
            "city": "",
            "region": "",
            "country": ""
          }
        },
        "registration_details": {
          "registration_date": "",
          "last_update": "",
          "status": "",
          "next_renewal": "",
          "lei_issuer": "",
          "corroboration_level": "",
          "data_validated_at": "",
          "data_validated_as": ""
        }
      }
    }
  },
  // UAM
  {
    service: 'UAM',
    InvalidResponse: {
      "udyog_aadhaar_array": {
        "enterprise_name": "",
        "major_activity": "",
        "social_category": "",
        "enterprise_type": "",
        "date_of_commencement": "",
        "dic_name": "",
        "state": "",
        "applied_date": ""
      },
      "nic_code": {
        "nic_2_digit": "",
        "nic_4_digit": "",
        "nic_5_digit": "",
        "activity_type": ""
      },
      "plant_location_detail": [
        {
          "label": "",
          "value": ""
        },
        {
          "label": "",
          "value": ""
        },
        {
          "label": "",
          "value": ""
        },
        {
          "label": "",
          "value": ""
        }
      ]
    }
  },
  // UAM with phone
  {
    service: 'UAMPhone',
    InvalidResponse: {
      "Driving License Number": "",
      "Owner's Name": "",
      "Father's Name": "",
      "Date of Birth": "",
      "Address": "",
      "Blood group": "",
      "Gender": "",
      "Status": "",
      "RTO (Issued At)": "",
      "LicenseDetails": [
        {
          "License Type": "",
          "Issue Date From": "",
          "Issue Date To": ""
        },
        {
          "License Type": "",
          "Issue Date From": "",
          "Issue Date To": ""
        },
        {
          "License Type": "",
          "Issue Date From": "",
          "Issue Date To": ""
        },
        {
          "License Type": "",
          "Issue Date From": "",
          "Issue Date To": ""
        }
      ],
      "CovDetails": [
        {
          "Vehicle Type": "",
          "Vehicle Class": "",
          "COV Issue Date": ""
        },
        {
          "Vehicle Type": "",
          "Vehicle Class": "",
          "COV Issue Date": ""
        }
      ],
      "imgurl": ""
    }
  }
];

export const findingInValidResponses = (serviceName) => {
  const match = inValidResponses.find((item) => item.service === serviceName);
  return match?.InValidResponse || null;
};

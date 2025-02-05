// const //logger = require("../..///logger///logger");
const ServiceTrackingModel = require("../models/ServiceTrackingModel.model");

exports.saveServiceTrackingModels = async (req, res) => {
  try {
    const newService = req.body;
    const response = await ServiceTrackingModel.create(newService);

    res.status(201).json({
      success: true,
      data: response,
      message: "Service tracking model saved successfully.",
    });
  } catch (error) {
    console.log("Error saving service tracking model:", error);
    let errorMessage = {
      message:
        "There was a problem saving the service tracking model. Try again after some time",
      statusCode: 404,
    };
    return next(errorMessage);
  }
};
exports.getAllServiceTrackingModels = async (req, res) => {
  try {
    const serviceTrackingModels = await ServiceTrackingModel.find();
    //logger.info("serviceTrackingModels===>", serviceTrackingModels);
    res.status(200).json({
      success: true,
      data: serviceTrackingModels,
      message: "Service tracking models retrieved successfully.",
    });
  } catch (error) {
    console.log("Error retrieving service tracking models:", error);
    let errorMessage = {
      message: `There was a problem retrieving the service tracking models. Try again after some time`,
      statusCode: 404,
    };
    return next(errorMessage);
  }
};
exports.getServiceTrackingModelByName = async (req, res, next) => {
  console.log(req.params);
  try {
    const serviceName = req.params.serviceName;
    console.log("serviceName===>", serviceName);
    const serviceTrackingModel = await ServiceTrackingModel.findOne({
      serviceName,
    });
    console.log("serviceTrackingModel===>", serviceTrackingModel);
    if (!serviceTrackingModel) {
      let errorMessage = {
        message: `Service tracking model with name ${serviceName} not found.`,
        statusCode: 404,
      };
      return next(errorMessage);
    }
    res.status(200).json({
      success: true,
      data: serviceTrackingModel,
      message: "Service tracking model retrieved successfully.",
    });
  } catch (error) {
    console.log(
      `Error retrieving service tracking model by name ${req.params.serviceName}:`,
      error
    );
    let errorMessage = {
      message: "Internal Server Error Try again After Some time",
      statusCode: 404,
    };
    return next(errorMessage);
  }
};

exports.updateServiceTracking = async (req, res, next) => {
  const {
    serviceName,
    serviceFor,
    serviceClientId,
    serviceSecretKey,
    serviceStatus,
    serviceType,
  } = req.body;
  if (!serviceName || !serviceFor) {
    let errorMessage = {
      message: "serviceName and serviceFor are required",
      statusCode: 400,
    };
    return next(errorMessage);
  }

  try {
    const service = await ServiceTrackingModel.findOneAndUpdate(
      { serviceName, serviceFor },
      {
        serviceClientId,
        serviceSecretKey,
        serviceStatus,
        serviceType,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );
    if (!service) {
      let errorMessage = {
        message: "Service not found",
        statusCode: 404,
      };
      return next(errorMessage);
    }
    return res
      .status(200)
      .json({
        success: true,
        message: "Service updated successfully",
        service,
      });
  } catch (error) {
    console.log("Error updating service:", error);
    let errorMessage = {
      message: "Internal server error Try again after some time",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};
exports.DeleteServiceTracking = async (req, res, next) => {
  const { serviceName } = req.params;
  if (!serviceName) {
    let errorMessage = {
      message: "serviceName and serviceFor are required",
      statusCode: 400,
    };
    return next(errorMessage);
  }
  try {
    const service = await ServiceTrackingModel.findOneAndDelete({
      serviceName,
    });
    console.log("deleted service", service);

    if (!service) {
      let errorMessage = {
        message: "Service not found",
        statusCode: 400,
      };
      return next(errorMessage);
    }

    return res
      .status(200)
      .json({
        success: true,
        message: "Service deleted successfully",
        service,
      });
  } catch (error) {
    console.log("Error deleting service", error);
    let errorMessage = {
      message: "Internal server error Try again after some time",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};

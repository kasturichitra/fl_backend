exports.GlobalExceptionHandling = (err, req, res, next) => {
    console.error("error message in global exception handler===>", err);
    const statusCode = err.statusCode || 500;
    const response = {
        status: 'error',
        message: err.message || 'Internal Server Error',
    };
    if (err.code && err.code === 11000) {
        response.message = 'Duplicate field value entered';
        return res.status(400).json(response);
    }
    if(err.statusCode===400){
        return res.status(statusCode).json(err);
    }
    return res.status(statusCode).json(err);
};

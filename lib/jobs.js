const Jobs = Kadira.Jobs = {};

// XXX: see if we can do await with these and use pure promises instead
Jobs.getAsync = async function(id, callback) {
  try {
    const data = await Kadira.coreApi.getJob(id)
    callback(null, data);
  } catch (error) {
    callback(error);
  }
};


Jobs.setAsync = function(id, changes, callback) {
  try {
    const data = await Kadira.coreApi.updateJob(id, changes)
    callback(null, data);
  } catch (error) {
    callback(error);
  }
};

Jobs.set = Kadira._wrapAsync(Jobs.setAsync);
Jobs.get = Kadira._wrapAsync(Jobs.getAsync);

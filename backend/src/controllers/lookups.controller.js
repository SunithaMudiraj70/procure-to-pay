import * as lookupsService from '../services/lookups.service.js';

export const getUsers = async (req, res, next) => {
  try {
    const users = await lookupsService.getActiveUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

export const getLookups = async (req, res, next) => {
  try {
    const lookups = await lookupsService.getLookups();
    res.status(200).json(lookups);
  } catch (error) {
    next(error);
  }
};

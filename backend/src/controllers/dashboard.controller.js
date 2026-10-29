import * as dashboardService from '../services/dashboard.service.js';

export const getKpis = async (req, res, next) => {
  try {
    const data = await dashboardService.getKpis();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getSpendByDept = async (req, res, next) => {
  try {
    const data = await dashboardService.getSpendByDepartment();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getPipeline = async (req, res, next) => {
  try {
    const data = await dashboardService.getPipeline();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

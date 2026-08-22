import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './notifications.service.js';

export const getNotificationsController = async (req, res, next) => {
  try {
    const { category, unreadOnly, page, limit } = req.query;
    const userId = req.user._id;

    const result = await getUserNotifications(userId, { category, unreadOnly, page, limit });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const markReadController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const result = await markNotificationAsRead(userId, id);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const markAllReadController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const result = await markAllNotificationsAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

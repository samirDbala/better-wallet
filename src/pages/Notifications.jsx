import { useEffect, useRef, useState } from "react";
import { Bell, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { listenToBudgets } from "../firebase/budget";
import {
  deleteNotification,
  listenToNotifications,
  markAllNotificationsAsRead,
} from "../firebase/notifications";

import "../styles/notifications.css";

function formatNotificationTime(createdAt) {
  if (!createdAt) {
    return null;
  }

  let notificationDate;

  if (typeof createdAt.toDate === "function") {
    notificationDate = createdAt.toDate();
  } else if (createdAt instanceof Date) {
    notificationDate = createdAt;
  } else {
    notificationDate = new Date(createdAt);
  }

  if (Number.isNaN(notificationDate.getTime())) {
    return null;
  }

  const date = notificationDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const time = notificationDate.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

  return { date, time };
}

function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [activeBudget, setActiveBudget] = useState(null);
  const [allNotifications, setAllNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [swipingNotification, setSwipingNotification] = useState(null);
  const [deletingNotification, setDeletingNotification] = useState(null);

  const swipeRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setActiveBudget(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    let unsubscribeNotifications;

    const unsubscribeBudgets = listenToBudgets(
      user.uid,
      (updatedBudgets) => {
        const now = new Date();

        const currentBudget =
          updatedBudgets
            .filter((budget) => {
              if (
                !budget.startDate ||
                budget.status === "held" ||
                budget.status === "completed"
              ) {
                return false;
              }

              const startDate = budget.startDate.toDate();

              if (!budget.endDate) {
                return startDate <= now;
              }

              const endDate = budget.endDate.toDate();

              return startDate <= now && now < endDate;
            })
            .sort((a, b) => {
              const aTime =
                a.createdAt?.toMillis?.() ?? a.startDate?.toMillis?.() ?? 0;

              const bTime =
                b.createdAt?.toMillis?.() ?? b.startDate?.toMillis?.() ?? 0;

              return bTime - aTime;
            })[0] || null;

        setActiveBudget(currentBudget);
      },
      (error) => {
        console.error("Unable to sync budgets:", error);

        setActiveBudget(null);
        setNotifications([]);
        setLoading(false);
      },
    );

    unsubscribeNotifications = listenToNotifications(
      user.uid,
      (updatedNotifications) => {
        setAllNotifications(updatedNotifications);
        setLoading(false);
      },
    );

    return () => {
      unsubscribeBudgets();

      if (unsubscribeNotifications) {
        unsubscribeNotifications();
      }
    };
  }, [user]);

  useEffect(() => {
    if (!activeBudget) {
      setNotifications([]);
      return;
    }

    const budgetNotifications = allNotifications.filter(
      (notification) => notification.budgetId === activeBudget.id,
    );

    setNotifications(budgetNotifications);

    async function markNotificationsAsRead() {
      try {
        await markAllNotificationsAsRead(user.uid, budgetNotifications);
      } catch (error) {
        console.error("Unable to mark notifications as read:", error);
      }
    }

    markNotificationsAsRead();
  }, [activeBudget, allNotifications, user]);

  function handleTouchStart(event, notification) {
    if (deletingNotification === notification.id) {
      return;
    }

    const touch = event.touches[0];

    swipeRef.current = {
      id: notification.id,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      direction: null,
      isSwiping: false,
    };
  }

  function handleTouchMove(event, notification) {
    const swipe = swipeRef.current;

    if (!swipe || swipe.id !== notification.id) {
      return;
    }

    const touch = event.touches[0];

    const deltaX = touch.clientX - swipe.startX;
    const deltaY = touch.clientY - swipe.startY;

    if (!swipe.isSwiping && Math.abs(deltaY) > Math.abs(deltaX)) {
      swipeRef.current = null;
      setSwipingNotification(null);
      return;
    }

    if (Math.abs(deltaX) < 4) {
      return;
    }

    swipe.isSwiping = true;
    swipe.currentX = touch.clientX;

    const direction = deltaX < 0 ? "left" : "right";
    swipe.direction = direction;

    const distance = Math.min(Math.abs(deltaX), 110);

    setSwipingNotification({
      id: notification.id,
      distance,
      direction,
      ready: distance >= 70,
    });
  }

  async function handleTouchEnd(notification) {
    const swipe = swipeRef.current;

    if (!swipe || swipe.id !== notification.id) {
      return;
    }

    const deltaX = swipe.currentX - swipe.startX;

    swipeRef.current = null;

    if (swipe.isSwiping && Math.abs(deltaX) >= 70) {
      await handleDeleteNotification(notification.id);
      return;
    }

    setSwipingNotification(null);
  }

  function handlePointerDown(event, notification) {
    if (event.pointerType !== "mouse") {
      return;
    }

    if (deletingNotification === notification.id) {
      return;
    }

    swipeRef.current = {
      id: notification.id,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      direction: null,
      isSwiping: false,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event, notification) {
    if (event.pointerType !== "mouse") {
      return;
    }

    const swipe = swipeRef.current;

    if (!swipe || swipe.id !== notification.id) {
      return;
    }

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;

    if (!swipe.isSwiping && Math.abs(deltaY) > Math.abs(deltaX)) {
      swipeRef.current = null;
      setSwipingNotification(null);
      return;
    }

    if (Math.abs(deltaX) < 4) {
      return;
    }

    swipe.isSwiping = true;
    swipe.currentX = event.clientX;

    const direction = deltaX < 0 ? "left" : "right";
    swipe.direction = direction;

    const distance = Math.min(Math.abs(deltaX), 110);

    setSwipingNotification({
      id: notification.id,
      distance,
      direction,
      ready: distance >= 70,
    });
  }

  async function handlePointerUp(event, notification) {
    if (event.pointerType !== "mouse") {
      return;
    }

    const swipe = swipeRef.current;

    if (!swipe || swipe.id !== notification.id) {
      return;
    }

    const deltaX = swipe.currentX - swipe.startX;

    swipeRef.current = null;

    if (swipe.isSwiping && Math.abs(deltaX) >= 70) {
      await handleDeleteNotification(notification.id);
      return;
    }

    setSwipingNotification(null);
  }

  async function handleDeleteNotification(notificationId) {
    if (!user || deletingNotification === notificationId) {
      return;
    }

    try {
      setDeletingNotification(notificationId);

      await deleteNotification(user.uid, notificationId);

      setNotifications((currentNotifications) =>
        currentNotifications.filter(
          (notification) => notification.id !== notificationId,
        ),
      );

      setSwipingNotification(null);
    } catch (error) {
      console.error("Unable to delete notification:", error);

      setSwipingNotification(null);
    } finally {
      setDeletingNotification(null);
    }
  }

  return (
    <main className="notifications-page">
      <div className="notifications-screen">
        <header className="notifications-header">
          <div className="notifications-title">
            <Bell size={17} strokeWidth={1.8} />
            <h1>NOTIFICATIONS</h1>
          </div>

          <button
            className="notifications-close"
            type="button"
            aria-label="Close notifications"
            onClick={() => navigate("/home", { replace: true })}
          >
            <X size={19} strokeWidth={1.8} />
          </button>
        </header>

        <section className="notifications-list">
          {loading ? (
            <div className="notification-empty-card">
              <strong>Loading notifications...</strong>
            </div>
          ) : !activeBudget ? (
            <div className="notification-empty-card">
              <strong>No active budget</strong>
              <span>Create or resume a budget to see notifications.</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty-card">
              <strong>No notifications</strong>
              <span>You’re all caught up.</span>
            </div>
          ) : (
            notifications.map((notification) => {
              const swipe = swipingNotification?.id === notification.id;

              const distance = swipe ? swipingNotification.distance : 0;

              const direction = swipe ? swipingNotification.direction : null;

              const isReady = swipe && swipingNotification.ready;

              const isDeleting = deletingNotification === notification.id;

              return (
                <div
                  className={`notification-swipe-wrapper ${
                    swipe ? `swiping-${direction}` : ""
                  } ${isReady ? "swipe-ready" : ""} ${
                    isDeleting ? "notification-is-deleting" : ""
                  }`}
                  key={notification.id}
                >
                  <div className="notification-delete-background">
                    <Trash2 size={17} strokeWidth={1.8} />
                  </div>

                  <article
                    className={`notification-card ${
                      notification.read ? "read" : "unread"
                    }`}
                    style={{
                      transform: `translateX(${
                        direction === "right" ? distance : -distance
                      }px)`,
                    }}
                    onTouchStart={(event) =>
                      handleTouchStart(event, notification)
                    }
                    onTouchMove={(event) =>
                      handleTouchMove(event, notification)
                    }
                    onTouchEnd={() => handleTouchEnd(notification)}
                    onPointerDown={(event) =>
                      handlePointerDown(event, notification)
                    }
                    onPointerMove={(event) =>
                      handlePointerMove(event, notification)
                    }
                    onPointerUp={(event) =>
                      handlePointerUp(event, notification)
                    }
                    onPointerCancel={() => {
                      swipeRef.current = null;
                      setSwipingNotification(null);
                    }}
                  >
                    <div className="notification-card-content">
                      <strong>{notification.title}</strong>

                      {notification.type === "expense_added" &&
                      notification.expenseName ? (
                        <span className="notification-expense-name">
                          {notification.expenseName}
                        </span>
                      ) : null}

                      <span>{notification.message}</span>
                    </div>

                    {(() => {
                      const notificationTime = formatNotificationTime(
                        notification.createdAt,
                      );

                      if (!notificationTime) {
                        return null;
                      }

                      return (
                        <>
                          <time
                            className="notification-date"
                            dateTime={
                              notification.createdAt?.toDate
                                ? notification.createdAt.toDate().toISOString()
                                : undefined
                            }
                          >
                            {notificationTime.date}
                          </time>

                          <time
                            className="notification-time"
                            dateTime={
                              notification.createdAt?.toDate
                                ? notification.createdAt.toDate().toISOString()
                                : undefined
                            }
                          >
                            {notificationTime.time}
                          </time>
                        </>
                      );
                    })()}
                  </article>
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

export default Notifications;

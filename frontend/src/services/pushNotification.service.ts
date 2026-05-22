import api from "./api.service";

const getVapidPublicKey = async (): Promise<string> => {
  return (await api.get("/notifications/vapid-public-key")).data.publicKey;
};

const subscribe = async (subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) => {
  return (await api.post("/notifications/subscribe", subscription)).data;
};

const unsubscribe = async (endpoint: string) => {
  return (await api.post("/notifications/unsubscribe", { endpoint })).data;
};

export default {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
};

// Vercel Serverless Function — Garmin Data Sync
// Runs daily via cron (6am UTC) or on-demand via GET /api/garmin-sync
// Requires env vars: GARMIN_EMAIL, GARMIN_PASSWORD
// Data is stored in Vercel KV or returned directly to the client

import GarminConnect from "garmin-connect";

const { GarminConnect: Garmin } = GarminConnect;

let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3600000; // 1 hour

export default async function handler(req, res) {
  // CORS for frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    return res.status(200).json({
      status: "not_configured",
      message: "Set GARMIN_EMAIL and GARMIN_PASSWORD in Vercel env vars",
      data: null,
    });
  }

  // Return cached data if fresh
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL) {
    return res.status(200).json({ status: "ok", cached: true, data: cachedData });
  }

  try {
    const client = new Garmin();
    await client.login(email, password);

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Fetch data in parallel
    const [
      activities,
      dailyStats,
      heartRates,
      sleepData,
      userProfile,
    ] = await Promise.allSettled([
      client.getActivities(0, 20),
      client.getDailyStats(today),
      client.getHeartRate(today),
      client.getSleepData(yesterday),
      client.getUserProfile(),
    ]);

    // Try HRV separately (may not be available on all accounts)
    let hrvData = null;
    try {
      hrvData = await client.getHRVData(today);
    } catch {}

    const data = {
      syncedAt: new Date().toISOString(),
      activities: activities.status === "fulfilled" ? activities.value?.map(a => ({
        id: a.activityId,
        name: a.activityName,
        type: a.activityType?.typeKey,
        date: a.startTimeLocal,
        duration: a.duration, // seconds
        distance: a.distance, // meters
        avgHR: a.averageHR,
        maxHR: a.maxHR,
        avgPace: a.distance > 0 ? Math.round(a.duration / (a.distance / 1000)) : null, // sec/km
        calories: a.calories,
        avgRunningCadence: a.averageRunningCadenceInStepsPerMinute,
        elevationGain: a.elevationGain,
        trainingEffect: a.aerobicTrainingEffect,
        anaerobicTE: a.anaerobicTrainingEffect,
        vo2Max: a.vO2MaxValue,
      })) : [],
      dailyStats: dailyStats.status === "fulfilled" ? {
        steps: dailyStats.value?.totalSteps,
        calories: dailyStats.value?.totalKilocalories,
        restingHR: dailyStats.value?.restingHeartRate,
        activeMinutes: dailyStats.value?.activeSeconds ? Math.round(dailyStats.value.activeSeconds / 60) : null,
        stressLevel: dailyStats.value?.averageStressLevel,
      } : null,
      heartRate: heartRates.status === "fulfilled" ? {
        resting: heartRates.value?.restingHeartRate,
        min: heartRates.value?.minHeartRate,
        max: heartRates.value?.maxHeartRate,
      } : null,
      sleep: sleepData.status === "fulfilled" ? {
        duration: sleepData.value?.sleepTimeSeconds ? Math.round(sleepData.value.sleepTimeSeconds / 3600 * 10) / 10 : null,
        quality: sleepData.value?.overallSleepScore,
        deepSleep: sleepData.value?.deepSleepSeconds ? Math.round(sleepData.value.deepSleepSeconds / 60) : null,
        remSleep: sleepData.value?.remSleepSeconds ? Math.round(sleepData.value.remSleepSeconds / 60) : null,
      } : null,
      hrv: hrvData ? {
        weeklyAvg: hrvData?.weeklyAvg,
        lastNight: hrvData?.lastNightAvg,
        status: hrvData?.status,
      } : null,
      profile: userProfile.status === "fulfilled" ? {
        displayName: userProfile.value?.displayName,
      } : null,
    };

    cachedData = data;
    cacheTimestamp = Date.now();

    return res.status(200).json({ status: "ok", cached: false, data });
  } catch (err) {
    console.error("Garmin sync error:", err.message);
    return res.status(200).json({
      status: "error",
      message: err.message,
      data: cachedData,
    });
  }
}

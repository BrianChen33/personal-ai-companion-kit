import test from "node:test";
import assert from "node:assert/strict";
import { derivePresentation } from "../src/state.mjs";

test("reading and residual sadness coexist without another appraisal", () => {
  const result = derivePresentation(
    {
      generated_at: 1000,
      mood: { p: -0.3, labels: [{ label: "委屈", intensity: 0.6 }] },
      companion: {
        energy: { physical: 40, mental: 60 },
        contact_desire: 75,
        activity: { name: "阅读学习", started_at: 900, ends_at: 1200 },
      },
    },
    1010,
  );
  assert.equal(result.action, "reading");
  assert.equal(result.expression, "sad");
  assert.equal(result.energy, 0.5);
  assert.equal(result.contact, 0.75);
  assert.equal(result.stale, false);
});

test("planned activity and a passed deadline cannot invent a completed event", () => {
  const future = derivePresentation(
    {
      generated_at: 1000,
      companion: {
        activity: { name: "睡觉休息", started_at: 1100, ends_at: 1500 },
      },
    },
    1200,
  );
  assert.equal(future.action, "idle");
  const overdue = derivePresentation(
    {
      generated_at: 1000,
      companion: {
        activity: { name: "阅读学习", started_at: 900, ends_at: 950 },
      },
    },
    1200,
  );
  assert.equal(overdue.action, "reading");
  assert.equal(overdue.awaitingUpdate, true);
});

test("missing values remain unknown and old or invalid snapshots are explicit", () => {
  assert.equal(derivePresentation({ generated_at: 1000 }, 3000).energy, null);
  assert.equal(derivePresentation({ generated_at: 1000 }, 3000).stale, true);
  assert.throws(
    () => derivePresentation({ generated_at: Infinity }, 1000),
    /snapshot_time/,
  );
});

test("an actual walk stays outside past its estimated end, while future and owner plans do not move the character", () => {
  const snapshot = { generated_at: 1000, companion: {
    activity: { name: "散步", started_at: 900, ends_at: 950 },
  } };
  const outside = derivePresentation(snapshot, 1200);
  assert.equal(outside.presence, "away");
  assert.equal(outside.presenceText, "出去散步了");
  assert.equal(outside.awaitingUpdate, true);
  snapshot.companion.activity.started_at = 1300;
  assert.equal(derivePresentation(snapshot, 1200).presence, "unknown");
  snapshot.companion.activity = { name: "散步", started_at: 900, subject: "owner" };
  assert.equal(derivePresentation(snapshot, 1200).presence, "unknown");
});

test("only released activity or a verified location update changes presence", () => {
  const snapshot = { generated_at: 1000, companion: {}, daily_scene: {
    scene: { activity: "散步", stage: "started", occurred: 900, fields: { location: "小路" } },
    plan: { subject: "companion", anchors: [{ activity: "午睡", at: 1100 }] },
  } };
  assert.equal(derivePresentation(snapshot, 1010).presence, "away");
  snapshot.daily_scene.scene.stage = "completed";
  assert.equal(derivePresentation(snapshot, 1010).presence, "unknown");
  snapshot.home_state = { presence: "home", subject: "companion", occurred: 990 };
  assert.equal(derivePresentation(snapshot, 1010).presence, "home");
  snapshot.home_state.occurred = 1100;
  assert.equal(derivePresentation(snapshot, 1010).presence, "unknown");
  snapshot.daily_scene.scene = { activity: "阅读", stage: "started", occurred: 1000, fields: {} };
  assert.equal(derivePresentation(snapshot, 1010).presence, "home");
  snapshot.daily_scene.scene.fields.location = "公园";
  assert.equal(derivePresentation(snapshot, 1010).presence, "unknown");
  snapshot.daily_scene.scene.fields.location = "小屋";
  assert.equal(derivePresentation(snapshot, 1010).presence, "home");
});

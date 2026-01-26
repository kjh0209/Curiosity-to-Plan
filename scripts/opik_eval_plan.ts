// Load .env.local file
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Opik } from "opik";
import OpenAI from "openai";
import * as readline from "readline";

// Check for required env vars
if (!process.env.OPIK_API_KEY) {
  console.error("❌ Error: OPIK_API_KEY is not set in .env.local");
  console.log("\nPlease add the following to your .env.local file:");
  console.log("OPIK_API_KEY=your-opik-api-key");
  console.log("\nGet your API key from: https://www.comet.com/opik");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Error: OPENAI_API_KEY is not set in .env.local");
  process.exit(1);
}

// Initialize clients
const opik = new Opik({
  apiKey: process.env.OPIK_API_KEY,
  apiUrl: process.env.OPIK_URL_OVERRIDE || "https://www.comet.com/opik/api",
  projectName: process.env.OPIK_PROJECT_NAME || "skillloop",
  workspaceName: process.env.OPIK_WORKSPACE_NAME,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Plan generator function
async function generatePlan(interest: string, goal: string, minutesPerDay: number = 20): Promise<string> {
  const prompt = `Create a 14-day learning plan for "${interest}" with goal "${goal}".
Time: ${minutesPerDay} min/day.

Return JSON:
{"planTitle":"string","days":[{"dayNumber":1,"missionTitle":"string","focus":"string","difficulty":1},...]}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0]?.message?.content || "";
}

// Metrics
class IsJsonMetric {
  name = "is_json";
  async score(output: string): Promise<{ name: string; value: number }> {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { name: this.name, value: 0 };
      JSON.parse(jsonMatch[0]);
      return { name: this.name, value: 1 };
    } catch {
      return { name: this.name, value: 0 };
    }
  }
}

class UsefulnessMetric {
  name = "usefulness";
  async score(output: string): Promise<{ name: string; value: number }> {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { name: this.name, value: 0 };
      const parsed = JSON.parse(jsonMatch[0]);
      let score = 0;
      if (parsed.planTitle && parsed.planTitle.length > 5) score += 0.25;
      if (parsed.days && parsed.days.length >= 7) score += 0.25;
      if (parsed.days?.every((d: any) => d.missionTitle?.length > 5)) score += 0.25;
      if (parsed.days?.length > 0) {
        const diffs = parsed.days.map((d: any) => d.difficulty || 1);
        if (diffs[diffs.length - 1] >= diffs[0]) score += 0.25;
      }
      return { name: this.name, value: score };
    } catch {
      return { name: this.name, value: 0 };
    }
  }
}

// Default test items
const defaultTestItems = [
  { interest: "Machine Learning", goal: "Build a simple ML model", category: "tech" },
  { interest: "Piano", goal: "Play a simple piece", category: "music" },
  { interest: "Spanish", goal: "Basic conversation", category: "language" },
  { interest: "Cooking", goal: "Cook 5 dishes", category: "culinary" },
  { interest: "Photography", goal: "Take great photos", category: "art" },
];

// Interactive prompt
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runEvaluation(testItems: typeof defaultTestItems) {
  console.log("\n🚀 Starting Evaluation...\n");
  console.log(`📊 Project: ${process.env.OPIK_PROJECT_NAME}`);
  console.log(`🔑 Workspace: ${process.env.OPIK_WORKSPACE_NAME}`);
  console.log(`📝 Testing ${testItems.length} items\n`);

  const isJsonMetric = new IsJsonMetric();
  const usefulnessMetric = new UsefulnessMetric();

  const results: Array<{
    interest: string;
    isJson: number;
    usefulness: number;
    latency: number;
  }> = [];

  for (let i = 0; i < testItems.length; i++) {
    const item = testItems[i];
    console.log(`[${i + 1}/${testItems.length}] Evaluating: ${item.interest}...`);

    const startTime = Date.now();
    const output = await generatePlan(item.interest, item.goal);
    const latency = Date.now() - startTime;

    const isJsonScore = await isJsonMetric.score(output);
    const usefulnessScore = await usefulnessMetric.score(output);

    // Log to Opik
    const trace = opik.trace({
      name: "plan_evaluation",
      input: { interest: item.interest, goal: item.goal },
      output: { raw_output: output.substring(0, 500) },
      metadata: {
        category: item.category,
        latency_ms: latency,
        is_json: isJsonScore.value,
        usefulness: usefulnessScore.value,
      },
    });
    trace.end();

    results.push({
      interest: item.interest,
      isJson: isJsonScore.value,
      usefulness: usefulnessScore.value,
      latency,
    });

    console.log(`  ✓ is_json: ${isJsonScore.value === 1 ? "✅" : "❌"}`);
    console.log(`  ✓ usefulness: ${(usefulnessScore.value * 100).toFixed(0)}%`);
    console.log(`  ⏱ latency: ${latency}ms\n`);
  }

  await opik.flush();

  // Summary
  const avgIsJson = results.reduce((sum, r) => sum + r.isJson, 0) / results.length;
  const avgUsefulness = results.reduce((sum, r) => sum + r.usefulness, 0) / results.length;
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

  console.log("═══════════════════════════════════════");
  console.log("       📊 EVALUATION SUMMARY          ");
  console.log("═══════════════════════════════════════");
  console.log(`Total samples: ${results.length}`);
  console.log(`JSON validity: ${(avgIsJson * 100).toFixed(0)}%`);
  console.log(`Usefulness: ${(avgUsefulness * 100).toFixed(0)}%`);
  console.log(`Avg latency: ${avgLatency.toFixed(0)}ms`);
  console.log("");
  console.log("🔗 View in Opik Dashboard:");
  console.log(`   https://www.comet.com/${process.env.OPIK_WORKSPACE_NAME}/opik`);
  console.log("═══════════════════════════════════════");
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("    🧪 SkillLoop LLM Evaluation Tool   ");
  console.log("═══════════════════════════════════════\n");

  console.log("Options:");
  console.log("  1. Run with default samples (5 items)");
  console.log("  2. Add custom test item");
  console.log("  3. Run single custom test\n");

  const choice = await prompt("Choose option (1/2/3): ");

  if (choice === "1") {
    await runEvaluation(defaultTestItems);
  } else if (choice === "2") {
    const interest = await prompt("Enter interest (e.g., Python programming): ");
    const goal = await prompt("Enter goal (e.g., Build a web app): ");
    const category = await prompt("Enter category (e.g., tech): ");

    if (!interest || !goal) {
      console.log("Interest and goal are required!");
      return;
    }

    const customItems = [...defaultTestItems, { interest, goal, category: category || "custom" }];
    await runEvaluation(customItems);
  } else if (choice === "3") {
    const interest = await prompt("Enter interest: ");
    const goal = await prompt("Enter goal: ");

    if (!interest || !goal) {
      console.log("Interest and goal are required!");
      return;
    }

    await runEvaluation([{ interest, goal, category: "custom" }]);
  } else {
    console.log("Invalid choice. Running default tests...");
    await runEvaluation(defaultTestItems);
  }
}

main().catch(console.error);

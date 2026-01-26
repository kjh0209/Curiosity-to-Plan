import "dotenv/config";
import { Opik } from "opik";
import OpenAI from "openai";
import { PlanResponseSchema } from "../lib/schemas";

// Dataset item type
type PlanEvalItem = {
  input: string;
  metadata: {
    category: string;
  };
};

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

// Plan generator function (internal, not HTTP)
async function generatePlan(interest: string, goal: string, minutesPerDay: number = 20): Promise<string> {
  const prompt = `You are an expert learning curriculum designer. Create a structured 14-day learning plan as JSON.

User wants to learn: "${interest}"
Goal: "${goal}"
Time available per day: ${minutesPerDay} minutes

Generate exactly 14 days of learning missions. Each day should have:
- dayNumber (1-14)
- missionTitle (short, concrete)
- focus (brief focus area)
- difficulty (1, 2, or 3 - gradually increasing but realistic)

Return ONLY valid JSON matching this exact format:
{
  "planTitle": "string",
  "days": [
    { "dayNumber": 1, "missionTitle": "string", "focus": "string", "difficulty": 1 },
    ...
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content || "";
  return content;
}

// Custom IsJson metric
class IsJsonMetric {
  name = "is_json";

  async score(output: string): Promise<{ name: string; value: number }> {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { name: this.name, value: 0 };
      }
      JSON.parse(jsonMatch[0]);
      return { name: this.name, value: 1 };
    } catch {
      return { name: this.name, value: 0 };
    }
  }
}

// Custom ValidPlanSchema metric
class ValidPlanSchemaMetric {
  name = "valid_plan_schema";

  async score(output: string): Promise<{ name: string; value: number }> {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { name: this.name, value: 0 };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      PlanResponseSchema.parse(parsed);
      return { name: this.name, value: 1 };
    } catch {
      return { name: this.name, value: 0 };
    }
  }
}

// Usefulness metric (simple heuristic)
class UsefulnessMetric {
  name = "usefulness";

  async score(_input: string, output: string): Promise<{ name: string; value: number }> {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { name: this.name, value: 0 };
      }
      const parsed = JSON.parse(jsonMatch[0]);

      let score = 0;

      // Has valid title
      if (parsed.planTitle && parsed.planTitle.length > 5) score += 0.25;

      // Has 14 days
      if (parsed.days && parsed.days.length === 14) score += 0.25;

      // Days have meaningful titles
      if (parsed.days && parsed.days.every((d: any) => d.missionTitle && d.missionTitle.length > 5)) {
        score += 0.25;
      }

      // Difficulty progression exists
      if (parsed.days && parsed.days.length > 0) {
        const difficulties = parsed.days.map((d: any) => d.difficulty);
        const hasProgression = difficulties[difficulties.length - 1] >= difficulties[0];
        if (hasProgression) score += 0.25;
      }

      return { name: this.name, value: score };
    } catch {
      return { name: this.name, value: 0 };
    }
  }
}

// Test dataset items
const testItems: Array<{ interest: string; goal: string; category: string }> = [
  {
    interest: "Machine Learning",
    goal: "Build a simple classification model from scratch",
    category: "tech",
  },
  {
    interest: "Piano",
    goal: "Play a simple classical piece with both hands",
    category: "music",
  },
  {
    interest: "Spanish",
    goal: "Have a basic 5-minute conversation in Spanish",
    category: "language",
  },
  {
    interest: "Cooking",
    goal: "Prepare a 3-course Italian dinner",
    category: "culinary",
  },
  {
    interest: "Photography",
    goal: "Take professional-looking portrait photos",
    category: "art",
  },
];

async function runEvaluation() {
  console.log("Starting SkillLoop Plan Evaluation...\n");

  // Create or get dataset
  const dataset = await opik.getOrCreateDataset<PlanEvalItem>(
    "skillloop-plan-eval",
    "Dataset for evaluating SkillLoop plan generation"
  );

  // Insert test items
  const datasetItems = testItems.map((item, idx) => ({
    id: `eval-item-${idx}`,
    input: `Interest: ${item.interest}, Goal: ${item.goal}`,
    metadata: {
      category: item.category,
    },
  }));

  await dataset.insert(datasetItems);
  console.log(`Inserted ${datasetItems.length} items into dataset\n`);

  // Initialize metrics
  const isJsonMetric = new IsJsonMetric();
  const validSchemaMetric = new ValidPlanSchemaMetric();
  const usefulnessMetric = new UsefulnessMetric();

  // Run evaluation manually
  const results: Array<{
    input: string;
    output: string;
    isJson: number;
    validSchema: number;
    usefulness: number;
  }> = [];

  for (const item of testItems) {
    console.log(`Evaluating: ${item.interest}...`);

    const startTime = Date.now();
    const output = await generatePlan(item.interest, item.goal);
    const latency = Date.now() - startTime;

    const inputStr = `Interest: ${item.interest}, Goal: ${item.goal}`;

    const isJsonScore = await isJsonMetric.score(output);
    const validSchemaScore = await validSchemaMetric.score(output);
    const usefulnessScore = await usefulnessMetric.score(inputStr, output);

    // Log trace to Opik
    const trace = opik.trace({
      name: "plan_evaluation",
      input: { interest: item.interest, goal: item.goal },
      output: { raw_output: output.substring(0, 500) },
      metadata: {
        category: item.category,
        latency_ms: latency,
        is_json: isJsonScore.value,
        valid_schema: validSchemaScore.value,
        usefulness: usefulnessScore.value,
      },
    });
    trace.end();

    results.push({
      input: inputStr,
      output: output.substring(0, 200) + "...",
      isJson: isJsonScore.value,
      validSchema: validSchemaScore.value,
      usefulness: usefulnessScore.value,
    });

    console.log(`  - is_json: ${isJsonScore.value}`);
    console.log(`  - valid_schema: ${validSchemaScore.value}`);
    console.log(`  - usefulness: ${usefulnessScore.value}`);
    console.log(`  - latency: ${latency}ms\n`);
  }

  await opik.flush();

  // Calculate aggregates
  const avgIsJson = results.reduce((sum, r) => sum + r.isJson, 0) / results.length;
  const avgValidSchema = results.reduce((sum, r) => sum + r.validSchema, 0) / results.length;
  const avgUsefulness = results.reduce((sum, r) => sum + r.usefulness, 0) / results.length;

  console.log("=== Evaluation Summary ===");
  console.log(`Total samples: ${results.length}`);
  console.log(`Average is_json: ${avgIsJson.toFixed(2)}`);
  console.log(`Average valid_schema: ${avgValidSchema.toFixed(2)}`);
  console.log(`Average usefulness: ${avgUsefulness.toFixed(2)}`);
  console.log("\nResults logged to Opik. Check your dashboard at:");
  console.log(`https://www.comet.com/opik/${process.env.OPIK_WORKSPACE_NAME}/${process.env.OPIK_PROJECT_NAME}`);
}

runEvaluation().catch(console.error);

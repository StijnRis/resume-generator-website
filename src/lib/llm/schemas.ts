/** JSON schemas for Gemini structured output (responseJsonSchema). */

export const relevanceResponseSchema = {
  type: "object",
  properties: {
    experience_categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          order: { type: "integer", minimum: 1, maximum: 20 },
          reason: { type: "string" },
        },
        required: ["label", "order", "reason"],
        additionalProperties: false,
      },
    },
    attribute_categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          order: { type: "integer", minimum: 1, maximum: 20 },
          reason: { type: "string" },
        },
        required: ["label", "order", "reason"],
        additionalProperties: false,
      },
    },
    experience_analysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          id: { type: "string" },
          relevance_score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
          bullets: {
            type: "array",
            minItems: 3,
            items: {
              type: "object",
              properties: {
                topic: { type: "string" },
                importance: { type: "integer", minimum: 0, maximum: 100 },
              },
              required: ["topic", "importance"],
              additionalProperties: false,
            },
          },
        },
        required: ["category", "id", "relevance_score", "reason", "bullets"],
        additionalProperties: false,
      },
    },
    experience_merges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          member_ids: {
            type: "array",
            minItems: 2,
            items: { type: "string" },
          },
          category: { type: "string" },
          relevance_score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
          bullets: {
            type: "array",
            minItems: 3,
            items: {
              type: "object",
              properties: {
                topic: { type: "string" },
                importance: { type: "integer", minimum: 0, maximum: 100 },
              },
              required: ["topic", "importance"],
              additionalProperties: false,
            },
          },
        },
        required: [
          "member_ids",
          "category",
          "relevance_score",
          "reason",
          "bullets",
        ],
        additionalProperties: false,
      },
    },
    attribute_analysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          id: { type: "string" },
          relevance_score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
        },
        required: ["category", "id", "relevance_score", "reason"],
        additionalProperties: false,
      },
    },
    summary_importance: { type: "integer", minimum: 0, maximum: 100 },
  },
  required: [
    "experience_categories",
    "attribute_categories",
    "experience_analysis",
    "attribute_analysis",
    "experience_merges",
    "summary_importance",
  ],
  additionalProperties: false,
} as const;

export const biographyMappingResponseSchema = {
  type: "object",
  additionalProperties: { type: "string" },
} as const;

export const experienceTextResponseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    bullet_points: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["summary", "bullet_points"],
  additionalProperties: false,
} as const;

export const summaryResponseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
  },
  required: ["summary"],
  additionalProperties: false,
} as const;

export const batchedCvTextResponseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    experiences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          summary: { type: "string" },
          bullets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                text: { type: "string" },
              },
              required: ["id", "text"],
              additionalProperties: false,
            },
          },
          title: { type: "string" },
          organization: { type: "string" },
          location: { type: "string" },
        },
        required: ["id", "summary", "bullets"],
        additionalProperties: false,
      },
    },
    attributes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
        },
        required: ["id", "title"],
        additionalProperties: false,
      },
    },
    ui_labels: {
      type: "object",
      properties: {
        at: { type: "string" },
        present: { type: "string" },
        starting: { type: "string" },
        expected: { type: "string" },
      },
      required: ["at", "present", "starting", "expected"],
      additionalProperties: false,
    },
  },
  required: ["summary", "experiences", "attributes", "ui_labels"],
  additionalProperties: false,
} as const;

export const translateResponseSchema = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          translated: { type: "string" },
        },
        required: ["original", "translated"],
        additionalProperties: false,
      },
    },
  },
  required: ["translations"],
  additionalProperties: false,
} as const;

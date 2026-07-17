/** JSON schemas for Gemini structured output (responseJsonSchema). */

export const relevanceResponseSchema = {
  type: "object",
  properties: {
    category_analysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "work",
              "education",
              "volunteer",
              "extracurriculars",
              "events",
              "research",
              "projects",
              "skills",
              "tools",
              "interests",
              "certificates",
              "awards",
              "publications",
              "references",
              "languages",
            ],
          },
          relevance_score: { type: "integer", minimum: 1, maximum: 20 },
          reason: { type: "string" },
        },
        required: ["category", "relevance_score", "reason"],
        additionalProperties: false,
      },
    },
    experience_analysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "work",
              "education",
              "volunteer",
              "extracurriculars",
              "events",
              "research",
              "projects",
            ],
          },
          id: { type: "string" },
          relevance_score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
          suggested_bullet_points: { type: "integer", minimum: 0, maximum: 5 },
        },
        required: [
          "category",
          "id",
          "relevance_score",
          "reason",
          "suggested_bullet_points",
        ],
        additionalProperties: false,
      },
    },
    attribute_analysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "skills",
              "tools",
              "interests",
              "certificates",
              "awards",
              "publications",
              "references",
              "languages",
            ],
          },
          id: { type: "string" },
          relevance_score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
        },
        required: ["category", "id", "relevance_score", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["category_analysis", "experience_analysis", "attribute_analysis"],
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
          bullet_points: {
            type: "array",
            items: { type: "string" },
          },
          title: { type: "string" },
          organization: { type: "string" },
          location: { type: "string" },
        },
        required: ["id", "summary", "bullet_points"],
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
        attributes_heading: { type: "string" },
        present: { type: "string" },
        starting: { type: "string" },
        expected: { type: "string" },
        sections: {
          type: "object",
          properties: {
            work: { type: "string" },
            education: { type: "string" },
            volunteer: { type: "string" },
            extracurriculars: { type: "string" },
            events: { type: "string" },
            research: { type: "string" },
            projects: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      required: [
        "at",
        "attributes_heading",
        "present",
        "starting",
        "expected",
        "sections",
      ],
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

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyExperienceSubsetMerges,
  detectExperienceSubsetMerges,
  describeMergeReason,
} from "./merges";
import { splitMixedAttributeCategories } from "./attribute-merges";
import type {
  Biography,
  BiographyExperience,
  HighLevelAnalysis,
} from "@/lib/types";

function exp(
  partial: Partial<BiographyExperience> &
    Pick<BiographyExperience, "id" | "type" | "title">,
): BiographyExperience {
  return {
    start_date: "2024-01",
    location: "",
    ...partial,
  };
}

function biographyWith(experiences: BiographyExperience[]): Biography {
  return {
    basics: {
      name: "Test",
      email: "",
      image: "",
      phone: "",
      location: { city: "", region: "", country: "", country_code: "" },
      profiles: [],
    },
    label: "",
    summary: "",
    experiences,
    attributes: [],
  };
}

function emptyAnalysis(
  experienceIds: { id: string; category: string }[],
): HighLevelAnalysis {
  return {
    experience_categories: [
      { id: "Work Experience", label: "Work Experience", order: 1, reason: "" },
    ],
    attribute_categories: [],
    experience_analysis: experienceIds.map((item) => ({
      category: item.category,
      id: item.id,
      relevance_score: 50,
      reason: "Relevant.",
      bullets: [
        { id: `${item.id}-b1`, topic: `${item.id} topic a`, importance: 80 },
        { id: `${item.id}-b2`, topic: `${item.id} topic b`, importance: 70 },
        { id: `${item.id}-b3`, topic: `${item.id} topic c`, importance: 60 },
      ],
    })),
    attribute_analysis: [],
    experience_merges: [],
    summary_importance: 50,
  };
}

describe("detectExperienceSubsetMerges", () => {
  it("merges a title that is a subset of another at the same organization", () => {
    const biography = biographyWith([
      exp({
        id: "intern",
        type: "work",
        title: "Intern",
        position: "Intern",
        organization: "ACME",
      }),
      exp({
        id: "swe-intern",
        type: "work",
        title: "Software Engineering Intern",
        position: "Software Engineering Intern",
        organization: "ACME",
      }),
      exp({
        id: "other",
        type: "work",
        title: "Developer",
        position: "Developer",
        organization: "OtherCo",
      }),
    ]);

    const groups = detectExperienceSubsetMerges(biography);
    assert.equal(groups.length, 1);
    assert.deepEqual([...groups[0].member_ids].sort(), [
      "intern",
      "swe-intern",
    ]);
    assert.match(groups[0].reason, /subset/i);
    assert.match(groups[0].reason, /Intern/);
  });

  it("does not cluster unrelated hackathons or sports", () => {
    const biography = biographyWith([
      exp({
        id: "junc",
        type: "events",
        title: "Hackathon",
        organization: "Junction",
      }),
      exp({
        id: "htn",
        type: "events",
        title: "Hackathon",
        organization: "Hack the North",
      }),
      exp({ id: "run", type: "sports", title: "Marathon", organization: "" }),
      exp({ id: "swim", type: "sports", title: "Swimming", organization: "" }),
    ]);

    assert.deepEqual(detectExperienceSubsetMerges(biography), []);
  });

  it("merges exact duplicates with the same title and organization", () => {
    const biography = biographyWith([
      exp({
        id: "a",
        type: "work",
        title: "Frontend Developer",
        position: "Frontend Developer",
        organization: "ACME",
      }),
      exp({
        id: "b",
        type: "work",
        title: "Frontend Developer",
        position: "Frontend Developer",
        organization: "ACME",
      }),
    ]);

    const groups = detectExperienceSubsetMerges(biography);
    assert.equal(groups.length, 1);
    assert.match(groups[0].reason, /duplicate/i);
  });

  it("does not merge generic untitled hackathons with no organization", () => {
    const biography = biographyWith([
      exp({ id: "h1", type: "events", title: "Hackathon", organization: "" }),
      exp({ id: "h2", type: "events", title: "Hackathon", organization: "" }),
    ]);
    assert.deepEqual(detectExperienceSubsetMerges(biography), []);
  });

  it("merges a nested chain into one group under the longest title", () => {
    const biography = biographyWith([
      exp({
        id: "intern",
        type: "work",
        title: "Intern",
        organization: "ACME",
      }),
      exp({
        id: "swe",
        type: "work",
        title: "Software Intern",
        organization: "ACME",
      }),
      exp({
        id: "senior",
        type: "work",
        title: "Senior Software Intern",
        organization: "ACME",
      }),
    ]);

    const groups = detectExperienceSubsetMerges(biography);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].member_ids.length, 3);
  });

  it("does not merge two different internships that only share a generic shorter title", () => {
    const biography = biographyWith([
      exp({
        id: "intern",
        type: "work",
        title: "Intern",
        organization: "ACME",
      }),
      exp({
        id: "product",
        type: "work",
        title: "Product Intern",
        organization: "ACME",
      }),
      exp({
        id: "swe",
        type: "work",
        title: "Software Intern",
        organization: "ACME",
      }),
    ]);

    const groups = detectExperienceSubsetMerges(biography);
    assert.ok(groups.every((group) => group.member_ids.length === 2));
    const allIds = groups.flatMap((group) => group.member_ids);
    assert.equal(new Set(allIds).size, allIds.length);
    assert.ok(
      !groups.some((group) => {
        const set = new Set(group.member_ids);
        return set.has("product") && set.has("swe");
      }),
    );
  });
});

describe("applyExperienceSubsetMerges", () => {
  it("adds a code merge with an informative reason and does not dump every member bullet", () => {
    const biography = biographyWith([
      exp({
        id: "intern",
        type: "work",
        title: "Intern",
        position: "Intern",
        organization: "ACME",
      }),
      exp({
        id: "swe-intern",
        type: "work",
        title: "Software Engineering Intern",
        position: "Software Engineering Intern",
        organization: "ACME",
      }),
    ]);
    const analysis = emptyAnalysis([
      { id: "intern", category: "Work Experience" },
      { id: "swe-intern", category: "Work Experience" },
    ]);

    const next = applyExperienceSubsetMerges(biography, analysis);
    assert.equal(next.experience_merges?.length, 1);
    const group = next.experience_merges![0];
    assert.match(group.reason ?? "", /subset/i);
    assert.ok((group.bullets?.length ?? 0) <= 5);
    assert.ok((group.bullets?.length ?? 0) >= 1);
  });

  it("keeps an existing AI merge and fills a missing reason", () => {
    const biography = biographyWith([
      exp({
        id: "intern",
        type: "work",
        title: "Intern",
        organization: "ACME",
      }),
      exp({
        id: "swe-intern",
        type: "work",
        title: "Software Engineering Intern",
        organization: "ACME",
      }),
    ]);
    const analysis = emptyAnalysis([
      { id: "intern", category: "Work Experience" },
      { id: "swe-intern", category: "Work Experience" },
    ]);
    analysis.experience_merges = [
      {
        id: "merge-ai",
        category: "Work Experience",
        member_ids: ["intern", "swe-intern"],
        relevance_score: 80,
        bullets: [
          { id: "m1", topic: "Combined impact", importance: 90 },
          { id: "m2", topic: "Shared stack", importance: 70 },
          { id: "m3", topic: "Scope", importance: 60 },
        ],
      },
    ];

    const next = applyExperienceSubsetMerges(biography, analysis);
    assert.equal(next.experience_merges?.length, 1);
    assert.equal(next.experience_merges![0].id, "merge-ai");
    assert.equal(next.experience_merges![0].bullets?.length, 3);
    assert.match(next.experience_merges![0].reason ?? "", /subset/i);
  });
});

describe("describeMergeReason", () => {
  it("explains a subset merge by name", () => {
    const biography = biographyWith([
      exp({
        id: "intern",
        type: "work",
        title: "Intern",
        position: "Intern",
        organization: "ACME",
      }),
      exp({
        id: "swe-intern",
        type: "work",
        title: "Software Engineering Intern",
        position: "Software Engineering Intern",
        organization: "ACME",
      }),
    ]);
    const reason = describeMergeReason(biography, ["intern", "swe-intern"]);
    assert.match(reason, /subset/i);
  });
});

describe("splitMixedAttributeCategories", () => {
  it("splits Awards & Interests into single-focus categories", () => {
    const biography: Biography = {
      ...biographyWith([]),
      attributes: [
        { id: "award-1", type: "awards", title: "Dean’s List" },
        { id: "hobby-1", type: "interests", name: "Sailing" },
      ],
    };
    const analysis: HighLevelAnalysis = {
      experience_categories: [],
      attribute_categories: [
        {
          id: "Awards & Interests",
          label: "Awards & Interests",
          order: 1,
          reason: "Mixed extras",
        },
      ],
      experience_analysis: [],
      attribute_analysis: [
        {
          category: "Awards & Interests",
          id: "award-1",
          relevance_score: 40,
          reason: "Award",
        },
        {
          category: "Awards & Interests",
          id: "hobby-1",
          relevance_score: 60,
          reason: "Hobby",
        },
      ],
      summary_importance: 40,
    };

    const next = splitMixedAttributeCategories(biography, analysis);
    const award = next.attribute_analysis.find((item) => item.id === "award-1");
    const hobby = next.attribute_analysis.find((item) => item.id === "hobby-1");
    assert.equal(award?.category, "Awards");
    assert.equal(hobby?.category, "Interests");
    assert.ok(
      next.attribute_categories.every((entry) => !/&| and /i.test(entry.label)),
    );
  });
});

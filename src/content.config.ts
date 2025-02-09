import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const clientSchema = z.object({
  name: z.string().optional(),
  logo: z.string().optional(),
  url: z.string().optional(),
  testimonial: z.string().optional(),
  testimonial_author: z.string().optional(),
});

export const collections = {
  work: defineCollection({
    // Load Markdown files in the src/content/work directory.
    loader: glob({ base: "./src/content/work", pattern: "**/*.md" }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      publishDate: z.coerce.date(),
      tags: z.array(z.string()),
      img: z.string(),
      img_alt: z.string().optional(),
      client: clientSchema.optional(),
    }),
  }),
};

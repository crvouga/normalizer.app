import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const exampleRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.name}!`,
      };
    }),

  getUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      // This would typically fetch from a database
      return {
        id: input.id,
        name: `User ${input.id}`,
        email: `user${input.id}@example.com`,
      };
    }),

  createUser: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
      })
    )
    .mutation(({ input }) => {
      // This would typically save to a database
      return {
        id: Math.random().toString(36).substr(2, 9),
        ...input,
        createdAt: new Date().toISOString(),
      };
    }),
});

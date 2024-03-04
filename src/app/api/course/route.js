import prisma from "@/lib/prisma";
import { authPayloadAccountId } from "@/middleware";
import { errorResponse, failResponse, successResponse } from "@/utils/response";
import { createSlug } from "@/utils/slugify";
import { Prisma } from "@prisma/client";
import Joi from "joi";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  let courses = await prisma.course.findMany({
    select: { slug: true, title: true, description: true, price: true },
  });

  return NextResponse.json(...successResponse({ courses: courses }));
}

export async function POST(request) {
  const schema = Joi.object({
    title: Joi.string().min(2).max(100).required(),
    description: Joi.string().min(10).max(3_000).required(),
    price: Joi.number().min(0).max(1_000_000).integer().required(),
  });

  const req = await request.json();
  const invalidReq = schema.validate(req);
  if (invalidReq.error) {
    return NextResponse.json(
      ...failResponse("Invalid request format.", 403, invalidReq.error.details),
    );
  }

  const payloadAdminId = headers().get(authPayloadAccountId);

  const admin = await prisma.admin.findUnique({
    where: { id: payloadAdminId, isBlocked: false, isEmailVerified: true },
  });

  if (!admin) {
    return NextResponse.json(
      ...failResponse(
        "Unauthorized account: You do not have permission to perform this action.",
        401,
      ),
    );
  }

  let course;

  try {
    course = await prisma.course.create({
      data: {
        title: req.title,
        description: req.description,
        price: parseInt(req.price),
        adminId: admin.id,
        slug: createSlug(req.title),
      },
      select: {
        slug: true,
        title: true,
        description: true,
        price: true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        ...failResponse("Invalid request", 409, e.message),
      );
    }
    return NextResponse.json(...errorResponse());
  }

  return NextResponse.json(...successResponse(course));
}

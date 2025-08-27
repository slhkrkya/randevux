import { IsEmail, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsISO8601()
  startsAt: string; // ISO string, ör: "2025-08-27T10:00:00+03:00"

  @IsISO8601()
  endsAt: string;

  @IsEmail()
  inviteeEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
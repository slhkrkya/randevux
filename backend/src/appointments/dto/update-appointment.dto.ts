import { IsISO8601, IsOptional, IsString, MaxLength, MinLength, IsIn } from 'class-validator';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Durumu serbest bırakmak istemezsen bu alanı kaldır. Aşağıda ayrıca /cancel endpointi var.
  @IsOptional()
  @IsIn(['PENDING','CONFIRMED','CANCELLED'])
  status?: 'PENDING'|'CONFIRMED'|'CANCELLED';
}
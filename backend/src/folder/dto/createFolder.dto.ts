import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateFolderDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;
}

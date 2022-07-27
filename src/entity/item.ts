import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity()
export class Item {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  a: string

  @Column()
  b: string

  @Column()
  c: string
}

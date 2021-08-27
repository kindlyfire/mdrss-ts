-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "volume" TEXT,
    "chapter" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "translatedLanguage" TEXT NOT NULL,
    "groupUuids" TEXT[],
    "uploaderUuid" TEXT NOT NULL,
    "mangaUuid" TEXT NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanlationGroup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manga" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uuid" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "originalLanguage" TEXT NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uuid" TEXT NOT NULL,
    "username" TEXT NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chapter.uuid_unique" ON "Chapter"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "ScanlationGroup.uuid_unique" ON "ScanlationGroup"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Manga.uuid_unique" ON "Manga"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "User.uuid_unique" ON "User"("uuid");

-- AddForeignKey
ALTER TABLE "Chapter" ADD FOREIGN KEY ("uploaderUuid") REFERENCES "User"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD FOREIGN KEY ("mangaUuid") REFERENCES "Manga"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

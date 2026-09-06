CREATE TABLE `journalEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`mode` enum('journal','brainstorm','decide') NOT NULL DEFAULT 'journal',
	`prompt` text NOT NULL,
	`response` text NOT NULL,
	`summary` text NOT NULL,
	`mood` varchar(32) NOT NULL,
	`energy` int NOT NULL DEFAULT 3,
	`tags` varchar(512) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journalEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `journal_entries_owner_created_idx` ON `journalEntries` (`ownerId`,`createdAt`);
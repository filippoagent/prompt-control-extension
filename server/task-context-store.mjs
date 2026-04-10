import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sqlite3 from 'sqlite3'
import { promisify } from 'node:util'

function resolveBoardDbPath() {
  return process.env.PROMPT_CONTROL_BOARD_DB_PATH
    || path.join(os.homedir(), '.openclaw', 'workspace', 'tasks', 'board.sqlite')
}

function openDb(dbPath) {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY)
  return {
    db,
    get: promisify(db.get.bind(db)),
    all: promisify(db.all.bind(db)),
    close: promisify(db.close.bind(db)),
  }
}

async function ensureDbExists(dbPath) {
  await fs.access(dbPath)
}

export async function loadTaskBoardSummary() {
  const dbPath = resolveBoardDbPath()
  await ensureDbExists(dbPath)

  const { all, close } = openDb(dbPath)
  try {
    const tasks = await all(`SELECT id, title, status, assignee, project, updated_at, archived FROM tasks ORDER BY datetime(updated_at) DESC`)

    const taskIds = tasks.map((task) => task.id)
    const tagsByTask = new Map()

    for (const taskId of taskIds) {
      const tags = await all(`SELECT tag FROM task_tags WHERE task_id = ? ORDER BY position ASC`, [taskId])
      tagsByTask.set(taskId, tags.map((row) => row.tag))
    }

    return {
      version: 1,
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        assignee: task.assignee,
        project: task.project ?? undefined,
        updatedAt: task.updated_at,
        archived: Boolean(task.archived),
        tags: tagsByTask.get(task.id) ?? [],
      })),
    }
  } finally {
    await close()
  }
}

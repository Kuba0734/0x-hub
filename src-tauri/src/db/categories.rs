use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub sort: i64,
    pub document_count: i64,
}

pub fn list(conn: &Connection) -> AppResult<Vec<Category>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.sort,
                (SELECT COUNT(*) FROM documents d WHERE d.category_id = c.id AND d.deleted_at IS NULL)
         FROM categories c ORDER BY c.sort, c.name",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Category {
            id: r.get(0)?,
            name: r.get(1)?,
            sort: r.get(2)?,
            document_count: r.get(3)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

fn clean_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 40 {
        return Err(AppError::Invalid(
            "Category names need 1 to 40 characters".into(),
        ));
    }
    Ok(name.to_string())
}

pub fn create(conn: &Connection, name: &str) -> AppResult<Category> {
    let name = clean_name(name)?;
    let id = super::new_id();
    let sort: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort), -1) + 1 FROM categories",
        [],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO categories (id, name, sort) VALUES (?1, ?2, ?3)",
        params![id, name, sort],
    )?;
    Ok(Category {
        id,
        name,
        sort,
        document_count: 0,
    })
}

pub fn rename(conn: &Connection, id: &str, name: &str) -> AppResult<()> {
    let name = clean_name(name)?;
    let n = conn.execute(
        "UPDATE categories SET name = ?1 WHERE id = ?2",
        params![name, id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Deleting a category leaves its documents uncategorized.
pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute("DELETE FROM categories WHERE id = ?1", params![id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crud() {
        let conn = crate::db::open_in_memory().unwrap();
        let c = create(&conn, "  Car  ").unwrap();
        assert_eq!(c.name, "Car");
        rename(&conn, &c.id, "Vehicle").unwrap();
        assert!(list(&conn).unwrap().iter().any(|x| x.name == "Vehicle"));
        delete(&conn, &c.id).unwrap();
        assert_eq!(list(&conn).unwrap().len(), 7);
        assert!(create(&conn, "   ").is_err());
    }
}

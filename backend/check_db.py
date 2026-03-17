import sqlite3, glob
dbs = glob.glob('../uploads/*.db') + glob.glob('uploads/*.db') + glob.glob('../data/*.db') + glob.glob('data/*.db')
print('Found DBs:', dbs)
for db in dbs:
    conn = sqlite3.connect(db)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    print(db, cursor.fetchall())
    conn.close()

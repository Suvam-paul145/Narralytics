import pandas as pd
from sqlite.schema_detector import detect_schema

df = pd.read_csv('data/amazon_sales.csv')
schema = detect_schema(df)

print('=== SCHEMA DETECTED ===')
print(f'Rows: {schema["row_count"]}')
print('\nNumeric columns:', schema['numeric_columns'])
print('Categorical columns:', schema['categorical_columns'])
print('\nAll columns:')
for col in schema['columns']:
    print(f'  {col["name"]} ({col["dtype"]})')
    if col['dtype'] == 'numeric':
        print(f'    Range: {col.get("min")} - {col.get("max")}')
    elif col['dtype'] == 'categorical':
        print(f'    Samples: {col.get("sample_values", [])}')

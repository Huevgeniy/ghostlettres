import os
from PIL import Image

# Откуда брать карты с белыми углами и куда сохранять чистые прямоугольники
INPUT_DIR = "raw_images"
OUTPUT_DIR = "public/roles"  # Скрипт сам создаст эту папку внутри игры

# Сколько пикселей откусить внутрь с каждой стороны, чтобы полностью убрать закругление
# 20-30 пикселей обычно идеально для таких сканов
CROP_AMOUNT = 25  


def remove_rounded_corners():
    if not os.path.exists(INPUT_DIR):
        print(f"Ошибка! Папка '{INPUT_DIR}' не найдена. Создайте её и положите туда карты.")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Читаем все картинки в папке
    files = [f for f in os.listdir(INPUT_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    if not files:
        print(f"В папке '{INPUT_DIR}' нет картинок!")
        return

    print(f"Найдено файлов для обработки: {len(files)}. Начинаю обрезку...")

    for filename in files:
        input_path = os.path.join(INPUT_DIR, filename)
        output_path = os.path.join(OUTPUT_DIR, filename)
        
        # Открываем картинку
        with Image.open(input_path) as im:
            width, height = im.size
            
            # Обрезаем края внутрь, полностью уничтожая круглые белые кончики
            clean_card = im.crop((
                CROP_AMOUNT, 
                CROP_AMOUNT, 
                width - CROP_AMOUNT, 
                height - CROP_AMOUNT
            ))
            
            # Сохраняем готовую прямоугольную карту в проект игры
            clean_card.save(output_path, "JPEG", quality=95)
            print(f"Файл {filename} успешно превращен в прямоугольник.")

    print(f"\n🎉 ВСЁ ГОТОВО! Все чистые карты сохранены по пути: {OUTPUT_DIR}")


if __name__ == "__main__":
    remove_rounded_corners()

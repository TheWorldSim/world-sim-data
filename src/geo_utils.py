from shapely import LineString, Polygon


def safe_join_linestrings(linestrings: list[LineString]) -> LineString:
    last_point = linestrings[0].coords[0]
    coords = [last_point]
    for line in linestrings:
        point1 = line.coords[0]
        points = line.coords[1:]
        if point1 == last_point:
            coords.extend(points)
            last_point = points[-1]
        else:
            raise ValueError(f"Line {line} does not connect to the previous line at point {last_point}")
    return LineString(coords)


def join_linestrings(linestrings: list[LineString], close=False) -> LineString:
    last_point = linestrings[0].coords[0]
    coords = [last_point]
    for line in linestrings:
        point1 = line.coords[0]
        points = line.coords[1:]
        if point1 == last_point:
            coords.extend(points)
            last_point = points[-1]
        else:
            print(f"Warning: Line {line} does not connect to the previous line at point {last_point}. Joining anyway.")
            coords.append(point1)
            coords.extend(points)
            last_point = points[-1]

    if close:
        coords.append(coords[0])

    return LineString(coords)


def swap_lat_lng(coords: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return [(lng, lat) for lat, lng in coords]

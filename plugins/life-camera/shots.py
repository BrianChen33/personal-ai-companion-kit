"""Small physical shot plans and source-bound host visual observations."""
import hashlib

from .library import text


def prepare(value, camera):
    if not isinstance(value, dict) or set(value) != {'support', 'viewpoint', 'framing', 'hands', 'objects'}:
        raise ValueError('camera_shot_fields_required')
    support, hands, objects = value['support'], value['hands'], value['objects']
    if support not in ('left_hand', 'right_hand', 'surface'):
        raise ValueError('camera_shot_support_required')
    if not isinstance(hands, dict) or not set(hands) <= {'left', 'right'}:
        raise ValueError('camera_shot_visible_hands_required')
    if camera != 'mirror' and support.removesuffix('_hand') in hands:
        raise ValueError('camera_shot_supporting_hand_is_behind_lens')
    if not isinstance(objects, list) or len(objects) > 8:
        raise ValueError('camera_shot_inventory_required')
    result = dict(support=support, viewpoint=text(value['viewpoint'], 200),
                  framing=text(value['framing'], 200),
                  hands={side: text(action, 160) for side, action in hands.items()}, objects=[])
    identities, occupied = set(), set()
    for item in objects:
        if not isinstance(item, dict) or set(item) != {'id', 'label', 'quantity', 'unit', 'location'}:
            raise ValueError('camera_shot_object_fields_required')
        identity, location = text(item['id'], 60), item['location']
        if identity in identities or identity == 'capture_device':
            raise ValueError('camera_shot_object_identity_conflict')
        if type(item['quantity']) is not int or not 1 <= item['quantity'] <= 32:
            raise ValueError('camera_shot_object_quantity_required')
        if location not in ('surface', 'background', 'left_hand', 'right_hand'):
            raise ValueError('camera_shot_object_location_required')
        if location.endswith('_hand'):
            if location == support or location.removesuffix('_hand') not in hands or location in occupied:
                raise ValueError('camera_shot_hand_occupancy_conflict')
            occupied.add(location)
        identities.add(identity)
        result['objects'].append(dict(id=identity, label=text(item['label'], 120),
                                      quantity=item['quantity'], unit=text(item['unit'], 30), location=location))
    return result


def describe(shot, camera):
    support = shot['support']
    if support == 'surface':
        setup = 'The capture device rests on a stable support; both hands are available for the activity.'
    elif camera == 'mirror':
        setup = 'In the single reflection, the ' + support.replace('_', ' ') + ' holds the one capture device.'
    else:
        setup = 'The ' + support.replace('_', ' ') + ' supports the capture device behind its lens.'
    parts = ['Physical capture setup. ' + setup, 'Optical viewpoint: ' + shot['viewpoint'],
             'Visible framing: ' + shot['framing']]
    for side, action in shot['hands'].items():
        parts.append('Visible ' + side + ' hand: ' + action)
    for item in shot['objects']:
        parts.append(str(item['quantity']) + ' ' + item['unit'] + ' of ' + item['label'] +
                     ', located at ' + item['location'].replace('_', ' ') + ' [' + item['id'] + ']')
    parts.append('Each inventory entry is one physical item or set at its stated location. '
                 'An object in a hand has moved there from the surface. '
                 'The image is the view produced at the optical viewpoint described above.')
    return '\n'.join(parts)


def review(shot, camera, raw, value):
    fields = {'image_sha256', 'subject_count', 'capture_device_count', 'objects', 'issues'}
    if not isinstance(value, dict) or set(value) != fields:
        raise ValueError('camera_composition_review_required')
    expected = {item['id']: item['quantity'] for item in shot['objects']}
    counts = value['objects']
    if (value['image_sha256'] != hashlib.sha256(raw).hexdigest() or
            type(value['subject_count']) is not int or value['subject_count'] not in (0, 1) or
            (camera != 'rear' and value['subject_count'] != 1) or
            type(value['capture_device_count']) is not int or
            value['capture_device_count'] != (1 if camera == 'mirror' else 0) or
            not isinstance(counts, dict) or counts != expected or
            any(type(count) is not int for count in counts.values()) or value['issues'] != []):
        raise ValueError('camera_composition_review_mismatch')
    return dict(image_sha256=value['image_sha256'], subject_count=value['subject_count'],
                capture_device_count=value['capture_device_count'], objects=dict(counts), issues=[])
